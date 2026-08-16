<#
.SYNOPSIS
  One-time setup so Google Sign-In works on an Android emulator behind Netfree.

.DESCRIPTION
  Clears the two barriers Netfree puts in front of Google OAuth on a bare emulator:
    1. Netfree's root CAs aren't trusted      -> ERR_CERT_AUTHORITY_INVALID
    2. Chrome pins Google's keys, Netfree MITMs -> net_error -150
                                                   (ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN)
  See docs/google-oauth-netfree.md (חלק C).

.NOTES
  Requires an Android 13 (API 33) *Google APIs* AVD (NOT Play Store — needs adb root),
  already running with -writable-system:

    emulator -avd <your-api33-avd> -writable-system -no-snapshot -gpu host

  API 34+ moves the CA store into the conscrypt APEX; this will not stick there.
  Safe to re-run (idempotent).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\netfree-emulator-setup.ps1
#>
[CmdletBinding()]
param()

# NOT 'Stop': adb/openssl write progress to stderr, which PowerShell 5.1 turns into
# terminating NativeCommandError records even on exit code 0. We check state explicitly instead.
$ErrorActionPreference = 'Continue'
function Say  { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Wait-Boot {
  param($Adb, $TimeoutSec = 180)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    # Out-String, not .Trim(): mid-reboot adb returns nothing and $null.Trim() throws every 3s.
    if (((& $Adb shell getprop sys.boot_completed 2>$null) | Out-String).Trim() -eq '1') { return }
    Start-Sleep 3
  }
  Die "Emulator did not finish booting within ${TimeoutSec}s"
}
function Warn { param($m) Write-Host "  ! $m" -ForegroundColor Yellow }
function Die  { param($m) Write-Host "`nERROR: $m" -ForegroundColor Red; exit 1 }

# --------------------------------------------------------------- tools
$adb = (Get-Command adb -EA SilentlyContinue).Source
if (-not $adb) { $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" }
if (-not (Test-Path $adb)) { Die "adb not found (PATH or %LOCALAPPDATA%\Android\Sdk\platform-tools)" }

$openssl = (Get-Command openssl -EA SilentlyContinue).Source
if (-not $openssl) { $openssl = "$env:ProgramFiles\Git\mingw64\bin\openssl.exe" }
if (-not (Test-Path $openssl)) { Die "openssl not found (install Git for Windows)" }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("netfree-" + [Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$hashed = Join-Path $tmp 'hashed'; New-Item -ItemType Directory -Force -Path $hashed | Out-Null

try {
  # ------------------------------------------------------- preflight
  Say 'Checking emulator'
  & $adb wait-for-device
  $api = (& $adb shell getprop ro.build.version.sdk).Trim()
  if ($api -ne '33') { Warn "API $api (expected 33). API 34+ keeps certs in the conscrypt APEX - this will not stick." }

  & $adb root | Out-Null; Start-Sleep 3; & $adb wait-for-device
  if ((& $adb shell whoami).Trim() -ne 'root') { Die "adb root failed - is this a 'Google APIs' (non-Play-Store) image?" }

  # ------------------------------- 1. export NetFree roots from Windows
  Say 'Exporting NetFree root CAs from the Windows trust store'
  $roots = Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root |
             Where-Object { $_.Subject -match 'NetFree Root CA' } |
             Sort-Object Thumbprint -Unique
  if (-not $roots) { Die 'No NetFree roots in the Windows trust store - is Netfree installed on this machine?' }

  $pems = @()
  $i = 0
  foreach ($c in $roots) {
    $p = Join-Path $tmp "netfree_$i.pem"
    $b64 = [Convert]::ToBase64String($c.RawData, 'InsertLineBreaks')
    Set-Content -Path $p -Value "-----BEGIN CERTIFICATE-----`n$b64`n-----END CERTIFICATE-----" -Encoding ascii
    $pems += $p; $i++
  }
  Write-Host "  found $($pems.Count) NetFree roots"

  # Android matches system certs by <subject_hash_old>.0
  foreach ($p in $pems) {
    $h = (& $openssl x509 -inform PEM -subject_hash_old -in $p -noout 2>$null)
    if (-not $h) { continue }
    $h = $h.Trim(); $n = 0
    while (Test-Path (Join-Path $hashed "$h.$n")) { $n++ }
    Copy-Item $p (Join-Path $hashed "$h.$n")
  }
  $count = (Get-ChildItem $hashed).Count
  if ($count -eq 0) { Die 'Failed to hash any certificate' }
  Write-Host "  hashed $count certs"

  # --------------------------- 2. install into the system trust store
  Say 'Installing into /system/etc/security/cacerts'
  & $adb remount 2>&1 | Out-Null
  $writable = (& $adb shell 'touch /system/etc/security/cacerts/.w 2>/dev/null && rm /system/etc/security/cacerts/.w && echo ok') -match 'ok'
  if (-not $writable) {
    Warn '/system read-only - rebooting once so overlayfs takes effect'
    & $adb reboot; Start-Sleep 5; & $adb wait-for-device
    Wait-Boot $adb
    & $adb root | Out-Null; Start-Sleep 3; & $adb wait-for-device; & $adb remount 2>&1 | Out-Null
    $writable = (& $adb shell 'touch /system/etc/security/cacerts/.w 2>/dev/null && rm /system/etc/security/cacerts/.w && echo ok') -match 'ok'
    if (-not $writable) { Die 'Still read-only - start the emulator with -writable-system' }
  }

  & $adb push "$hashed\." /system/etc/security/cacerts/ 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Die 'adb push failed' }
  # Glob all, not *.0: the collision loop can emit <hash>.1, which Android drops silently without 644 + the label.
  & $adb shell 'chmod 644 /system/etc/security/cacerts/*; chown root:root /system/etc/security/cacerts/*; chcon u:object_r:system_security_cacerts_file:s0 /system/etc/security/cacerts/* 2>/dev/null; true' | Out-Null

  $onDevice = (& $adb shell 'ls /system/etc/security/cacerts | wc -l').Trim()
  Write-Host "  installed $count certs (store now holds $onDevice)"

  # ----------------- 3. Chrome SPKI allowlist (defeats certificate pinning)
  Say 'Building Chrome SPKI allowlist (roots + live MITM intermediates)'
  function Get-Spki {
    param($PemPath)
    # Binary through PowerShell pipes gets mangled - go via temp files.
    $pub = "$PemPath.pub"; $der = "$PemPath.der"; $dgst = "$PemPath.sha"
    # Set-Content creates the file even when openssl emits nothing, so size is the real check.
    function Test-HasContent { param($p) (Test-Path $p) -and (Get-Item $p).Length -gt 0 }

    & $openssl x509 -in $PemPath -pubkey -noout 2>$null | Set-Content -Path $pub -Encoding ascii
    if (-not (Test-HasContent $pub)) { return $null }
    & $openssl pkey -pubin -in $pub -outform der -out $der 2>$null
    if (-not (Test-HasContent $der)) { return $null }
    & $openssl dgst -sha256 -binary -out $dgst $der 2>$null
    if (-not (Test-HasContent $dgst)) { return $null }
    return [Convert]::ToBase64String([IO.File]::ReadAllBytes($dgst))
  }

  $spkis = New-Object System.Collections.Generic.HashSet[string]
  foreach ($p in $pems) { $s = Get-Spki $p; if ($s) { [void]$spkis.Add($s) } }

  # The intermediate that signs the MITM leaf rotates - read it live off a MITM'd host.
  $chain = ('' | & $openssl s_client -connect www.googleapis.com:443 -servername www.googleapis.com -showcerts 2>$null) -join "`n"
  # (?s) = Singleline: without it '.' never crosses newlines and the chain never matches.
  $certRx = [regex]'(?s)-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----'
  $j = 0; $mitm = 0
  foreach ($m in $certRx.Matches($chain)) {
    $cp = Join-Path $tmp "chain_$j.pem"; Set-Content -Path $cp -Value $m.Value -Encoding ascii; $j++
    $subj = (& $openssl x509 -in $cp -noout -subject 2>$null)
    if ($subj -match 'NetFree|Telzar') { $s = Get-Spki $cp; if ($s) { [void]$spkis.Add($s); $mitm++ } }
  }
  if ($spkis.Count -eq 0) { Die 'Could not compute any SPKI' }
  # The roots alone do NOT defeat pinning - the MITM intermediate must be in the list.
  if ($mitm -eq 0) { Die "Found no NetFree intermediate in the live chain ($j certs seen). Are you actually behind Netfree? Without it, pinning still fails with net_error -150." }
  Write-Host "  MITM intermediates picked up: $mitm"
  $list = ($spkis -join ',')
  Write-Host "  $($spkis.Count) SPKIs"

  & $adb shell "echo 'chrome --ignore-certificate-errors-spki-list=$list' > /data/local/tmp/chrome-command-line" | Out-Null
  # Written by root; without 644 Chrome (different UID) can't read it and drops the flags silently.
  & $adb shell 'chmod 644 /data/local/tmp/chrome-command-line' | Out-Null
  & $adb shell 'am force-stop com.android.chrome' | Out-Null

  # ---------------------------------------------------------- reboot
  Say 'Rebooting so the new system certs are picked up'
  & $adb reboot; Start-Sleep 5; & $adb wait-for-device
  Wait-Boot $adb

  Write-Host @"

✅ Emulator ready.

ONE MANUAL STEP (Chrome ignores the flags file until this is enabled):
  1. Open the Chrome app on the emulator
  2. Address bar ->  chrome://flags  ->  search "command"
  3. "Enable command line on non-rooted devices" -> Enabled -> Relaunch
     (the red "unsupported flag" banner afterwards is normal)

Verify:
  adb logcat -d | Select-String cr_CommandLine     # shows --ignore-certificate-errors-spki-list
  adb logcat -c ; <sign in from the app> ; adb logcat -d | Select-String "net_error -150"   # -> nothing

Then add a Google account (Settings > Passwords & accounts > Add account) and sign in from the app.
"@ -ForegroundColor Green

  # Explicit: otherwise the last native tool's exit code leaks out as the script's.
  exit 0
}
finally {
  Remove-Item $tmp -Recurse -Force -EA SilentlyContinue
}
