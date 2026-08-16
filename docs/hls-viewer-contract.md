# HLS Viewer Contract — Mass Viewing

**Owner:** `packages/media-server` (SCRUM-244 / A3d)
**Primary consumer:** SCRUM-171 (client HLS player)
**Related:** SCRUM-172 / D2 (freeze/resume state), SCRUM-208 (`Game.streamId`)

This document is the contract between the media server and any client that
plays the mass-viewing feed. If you are implementing the viewer, everything
you need is here.

---

## 1. The URL

```
GET /streams/:streamId/index.m3u8
```

Served by the media server over plain HTTP (`express.static`). There is no
reverse proxy or CDN in front of it today, so the origin is the media server
itself — port `8000` by default (`MEDIA_PORT`).

```
http://<media-server-host>:8000/streams/<streamId>/index.m3u8
```

Segments are referenced by **relative** URI inside the manifest
(`segment_000000042.ts`), so they resolve against the same directory. Do not
rewrite or absolutise them.

### `index.m3u8` is the only supported entry point

The stream directory also contains `source.m3u8`. **Do not use it.**

| File                | What it is                                          | For clients?      |
| ------------------- | --------------------------------------------------- | ----------------- |
| `index.m3u8`        | The published viewer playlist. Catch-up applied.     | ✅ Yes — use this |
| `source.m3u8`       | Raw FFmpeg output. Always at live edge, no catch-up. | ❌ Internal only  |
| `segment_*.ts`      | Media segments, referenced by both manifests.        | ✅ Via manifest   |
| `input.sdp`         | RTP ingest description.                              | ❌ Internal only  |

`source.m3u8` and `input.sdp` are currently reachable over HTTP because the
whole directory is served statically. That is an artefact, not an interface —
reading `source.m3u8` bypasses the entire freeze/catch-up mechanism and will
show the viewer content they are not supposed to see yet.

---

## 2. What the video looks like

One composited video track and one mixed audio track. A single playlist pull
gets the viewer everyone in the broadcast.

**Video** — host and players are tiled with `xstack`, each tile 640×360:

| Main video inputs | Layout                              |
| ----------------- | ----------------------------------- |
| 1                 | Full frame, no scaling (host-only)  |
| 2                 | Side by side                        |
| 3                 | Two on top, one bottom-left         |
| 4                 | 2×2 grid                            |

The **moderator is never a grid tile.** Their video is composited as a
320×180 overlay in the bottom-right corner, 24px from each edge, on top of
whatever the grid produced.

**Audio** — every participant's audio (host, players, moderator) is mixed
with `amix`. There is no per-participant audio track and no way to isolate
one speaker.

### Roster changes cause a discontinuity

When a player or moderator joins or leaves, FFmpeg is relaunched with the new
input set. The viewer sees the updated grid within a few seconds. Because the
output resolution and encoder state change at that boundary, the manifest
carries an `#EXT-X-DISCONTINUITY` tag there.

**Client requirement:** use a player that honours `EXT-X-DISCONTINUITY`.
`hls.js` and native Safari HLS both do this without configuration. A player
that ignores it may stall or show artefacts at roster changes.

---

## 3. Buffer behaviour — the important part

This is not a normal live stream. **The viewer is deliberately behind live,
and the gap only ever grows.**

### The model

The moderator opening a question freezes the viewer's feed. The server keeps
encoding the whole time; it simply stops advancing the viewer's playlist.
When the question's time is up, the viewer resumes **from where they froze** —
they do not skip forward to live.

```
lag = accumulatedPauseMs + (currently paused ? now - lastPausedAt : 0)
what the viewer sees = (everything encoded so far) - lag
```

`status`, `lastPausedAt` and `accumulatedPauseMs` live on the `Stream` record
and are written by SCRUM-172 / D2. The media server reads them directly via
its own Prisma client once per second and republishes `index.m3u8`
accordingly. There is no signal or endpoint between the servers.

### What this means for the client

- **Nothing to implement for freeze/resume.** During a freeze the playlist
  simply stops gaining new segments, so a standard HLS player runs out of
  buffered media and holds on the last frame by itself. On resume the new
  segments appear and playback continues. The client does not pause, seek, or
  react in any way.
- **A viewer joining mid-freeze needs no special handling.** `index.m3u8` is a
  shared file reflecting the current state — a late joiner fetches whatever
  the last sync wrote, which is already the frozen playlist. There is no
  per-viewer state, no join-time status field, and none is needed.
- **The lag accumulates for the whole session.** Every question adds its
  duration. After five 30-second questions the viewer is 2.5 minutes behind
  live and stays there. Unbounded drift is an approved product decision — do
  not "correct" it.
- **Never seek to the live edge.** Do not call anything that jumps to the end
  of the buffer. `hls.js` users: do not enable `liveSyncDuration` tuning or
  low-latency catch-up that would fast-forward the viewer. Doing so defeats
  the entire feature and shows the viewer answers before their question ends.
- **Seeking and scrubbing are out of scope entirely.** No seek bar, no DVR
  controls. The viewer watches a single forward-only position.

---

## 4. Manifest shape

```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:<n>
#EXT-X-PLAYLIST-TYPE:EVENT
#EXTINF:2,
segment_000000042.ts
...
```

| Property           | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| Segment duration   | 2 seconds                                                 |
| Window size        | Up to 6 segments (~12 seconds) ending at the viewer's position |
| Playlist type      | `EVENT`                                                   |
| Refresh rate       | Rewritten once per second                                 |
| Media sequence     | Monotonic, continues across roster relaunches             |
| Discontinuities    | Preserved from the source at relaunch boundaries          |

The manifest is written to a temp file and renamed into place, so a client
never reads a half-written playlist.

### Before the first segments exist

`index.m3u8` is **not created** until FFmpeg has produced at least one
segment — roughly a few seconds after the host starts broadcasting. Until
then the request returns **404**.

**Client requirement:** treat a 404 on `index.m3u8` as "not ready yet" and
retry, not as a fatal error. Do not surface it to the user as a failure
during the normal startup window.

---

## 5. Segment retention

Segments are **never deleted while the stream is running.** `hls_list_size` is
`0` and `delete_segments` is deliberately not set, because retention has to
cover the accumulated lag — which is unbounded by design. A fixed window
would eventually drop the very segments a lagging viewer is still playing.

The entire stream directory is removed when the broadcast ends
(`stopRecording`). Disk usage therefore grows linearly for the duration of a
broadcast and is reclaimed at teardown. There is no mid-stream cleanup, and
adding one would break the catch-up guarantee.

---

## 6. Quick reference for SCRUM-171

**Do:**
- Fetch `/streams/:streamId/index.m3u8`
- Use a standard HLS player with discontinuity support
- Retry on 404 during startup
- Let the player stall naturally during a freeze

**Don't:**
- Fetch `source.m3u8`
- Seek, scrub, or jump to live
- Implement pause/resume logic for questions
- Request per-viewer stream state at join time

A working reference implementation lives at
`packages/media-server/test-viewer.html`.
