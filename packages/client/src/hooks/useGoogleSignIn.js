import { useEffect, useRef, useCallback } from 'react';
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { authService } from '../services/auth.service';

// Configure once per app run. `webClientId` makes Google mint the idToken for
// the Firebase/web OAuth client, so `GoogleAuthProvider.credential(idToken)` is
// accepted downstream. On Android the client is selected automatically by
// package name + signing SHA-1.
//
// iOS GAP: iOS also needs `iosClientId` here plus an `iosUrlScheme` in the
// config plugin. The app is Android-only for now, so both are left out — add
// them when iOS Google sign-in is wired.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
  configured = true;
}

/**
 * Shared Google sign-in logic used by LazyAuthModal.
 *
 * Uses the native @react-native-google-signin account picker instead of the old
 * expo-auth-session browser flow. On-device logcat showed the browser flow
 * returning through the `com.hypulse.app:/oauthredirect` deep link, on which
 * expo-router navigated and unmounted the sign-in screen mid-flow (the button
 * unmounted ~112ms after the redirect's MainActivity START, before onSuccess
 * ran) — so the in-flight OAuth response was dropped and socialLogin never ran
 * (the "silent no-login"); the reused AuthRequest also produced the original
 * invalid_grant. The native flow returns the idToken in-process — no browser,
 * redirect or remount — so repeat login → logout → login works without a
 * restart.
 *
 * Returns { request, promptAsync }: `request` is a readiness flag kept for the
 * existing button-gating contract; native config is synchronous, so it is
 * always ready. `promptAsync` opens the account picker, exchanges the idToken
 * with Firebase and reports the Firebase ID token via onSuccess.
 */
export function useGoogleSignIn({ onSuccess, onError } = {}) {
  // Keep latest callbacks in refs so promptAsync stays stable across renders.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    ensureConfigured();
  }, []);

  const promptAsync = useCallback(async () => {
    try {
      ensureConfigured();
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      // Clear any cached Google session first so the picker always shows and no
      // stale account is silently reused between logins.
      await GoogleSignin.signOut();

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return; // user dismissed the picker — not an error
      }

      const { idToken } = response.data;
      if (!idToken) {
        onErrorRef.current?.(
          authService.handleAuthError(
            new Error('Google Sign-In returned no idToken')
          )
        );
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(firebaseAuth, credential);
      const firebaseToken = await result.user.getIdToken();
      onSuccessRef.current?.(firebaseToken);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        return; // user cancelled — not an error
      }
      const handled = authService.handleAuthError(err);
      if (handled.code !== 'USER_CANCELED') {
        onErrorRef.current?.(handled);
      }
    }
  }, []);

  // Native configuration is synchronous, so the request is ready immediately.
  return { request: true, promptAsync };
}
