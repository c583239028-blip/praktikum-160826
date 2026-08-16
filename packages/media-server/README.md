# Media Server Package — `@worldplay/media-server`

Located at `packages/media-server`. Handles live WebRTC media routing via **Mediasoup** (SFU), composites all broadcasters into a single HLS feed via **FFmpeg**, and publishes that feed for mass viewing. Exposes a Socket.IO interface used by the client.

**Port:** `8000` (HTTP + Socket.IO) | **UDP:** `10000–10079` (WebRTC) | **Node:** `>=24.0.0 <25`

> **Viewing the stream?** See [`docs/hls-viewer-contract.md`](../../docs/hls-viewer-contract.md) for the URL, manifest shape and catch-up buffer behaviour. That document is the contract for client work.

---

## Running

```bash
# Docker (recommended — from repo root)
npm run docker:up

# Local
cd packages/media-server
npm start           # requires .env at packages/media-server or repo root
```

---

## Source Layout

```
index.js                          # Express + Socket.IO server init, static HLS serving
src/
  config.js                       # Mediasoup worker/router options, RTC port range
  lib/
    prisma.js                     # Shared Prisma client for this package
  routes/
    status.routes.js              # GET / health check
  services/
    mediasoup.service.js          # Workers, routers, WebRTC + plain transports
    stream.service.js             # Per-stream media inputs, FFmpeg lifecycle
    ffmpeg.service.js             # FFmpeg args (grid/overlay/amix) + process management
    hls-playlist.service.js       # Publishes index.m3u8 with the catch-up buffer
    port-pool.service.js          # RTP port allocation for mediasoup -> FFmpeg
  sockets/
    stream.handler.js             # Socket.IO event wiring
  utils/
    logger.js                     # Structured logging
```

---

## Two Media Paths

A broadcast serves two very different audiences over one Mediasoup router:

| Path                | Audience                                | Transport                       | Scale                       |
| ------------------- | --------------------------------------- | ------------------------------- | --------------------------- |
| **WebRTC (SFU)**    | Participants — host, players, moderator | `WebRtcTransport`               | Low-latency, small group    |
| **HLS (composite)** | Mass viewers                            | `PlainTransport` → FFmpeg → HLS | One pull, unlimited viewers |

Every `HOST` / `PLAYER` / `MODERATOR` producer is consumed a second time over a
plain transport on `127.0.0.1` and fed into a single FFmpeg process, which
composites all of them into one `index.m3u8`. Viewers never join the SFU.

---

## Port Ranges

| Range         | Purpose                                               | Exposure          |
| ------------- | ----------------------------------------------------- | ----------------- |
| `8000`        | HTTP + Socket.IO                                      | Public            |
| `10000–10079` | WebRTC media (`RTC_MIN_PORT`/`RTC_MAX_PORT`)          | Public (UDP)      |
| `11000–12999` | RTP from Mediasoup to FFmpeg (`port-pool.service.js`) | **Loopback only** |

`8000` serves HTTP, Socket.IO, and the HLS manifest/segments directly to
clients, so it must stay bound to `0.0.0.0` — required exposure, not excess
(M11-05 / SCRUM-348). Putting it behind a reverse proxy is a separate,
future concern.

The RTP pool (`11000–12999`) is internal: FFmpeg's own listening port comes
from here, and `createPlainTransportForFFmpeg` connects to it over
`127.0.0.1` only — never published or opened in a firewall.

The `10000–10079` WebRTC range carries more than it looks like at a glance.
Viewers cost nothing here — they watch over HLS, never joining the SFU. But
every producing participant (host, players, moderators —
`useRemoteStreams.js`) draws from it twice over: once for their own
mediasoup transports (one send, sharing video + audio; up to `MAX_STREAMS`
(4) recv, capped per participant — up to 5 ports), and once more for the
`PlainTransport` that feeds their video into FFmpeg's HLS composite
(`createPlainTransportForFFmpeg` passes no explicit `port`, so mediasoup
allocates it from this same worker range — not from the RTP pool above).
A full broadcast — host + 3 players (game grid) + 2 moderators, 6 producers
— peaks around 30 + 6 = **36 ports**; the range is sized with headroom for
1–2 concurrent broadcasts (72/80), tighter than a WebRTC-only count would
suggest (M11-05 / SCRUM-348).

---

## Socket.IO Events

Event names are defined in `@worldplay/shared` (`SOCKET_EVENTS.STREAM`).

### Setup

| Event                      | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| `stream:init_broadcast`    | Create the stream record via the app server  |
| `stream:create_room`       | Allocate the Mediasoup router for the stream |
| `stream:create_transport`  | Create a WebRTC transport                    |
| `stream:connect_transport` | Complete the DTLS handshake                  |

### Media

| Event                   | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `stream:produce`        | Register a producer; role determines grid placement and starts HLS recording |
| `stream:consume`        | Consume another participant's media over WebRTC                              |
| `stream:resume`         | Resume a paused consumer                                                     |
| `stream:producer_pause` | Owner toggles their own camera/mic; broadcasts the new state to the room     |
| `stream:join`           | Join the broadcast room and negotiate capabilities                           |
| `stream:ended`          | Teardown — close the router, stop FFmpeg, mark the stream `FINISHED`         |

---

## HTTP Endpoints

| Route                               | Purpose                                        |
| ----------------------------------- | ---------------------------------------------- |
| `GET /`                             | Health check                                   |
| `GET /streams/:streamId/index.m3u8` | The viewer playlist — see the contract doc     |
| `POST /live/stop/:streamId`         | Stop recording and delete the stream directory |

---

## Stream Lifecycle

```
stream:init_broadcast
  → Stream record created via the app server

stream:create_room
  → Mediasoup router allocated

stream:produce (HOST / PLAYER / MODERATOR)
  → Producer added to the router
  → Consumed again over a plain transport on an allocated RTP port
  → FFmpeg launched once host video is present
    (waits up to 3s for audio so the first launch includes it)
  → index.m3u8 publishing starts

Roster change (player or moderator joins or leaves)
  → FFmpeg relaunched with the new input set
  → Segment numbering continues; a discontinuity is recorded

Question opened / closed (SCRUM-172 writes Stream.status)
  → No FFmpeg change — encoding continues throughout
  → index.m3u8 stops (and later resumes) advancing for the viewer

stream:ended / host disconnect
  → FFmpeg stopped, transports and ports released
  → Stream directory deleted, DB status → FINISHED
```

Note that a question **does not pause FFmpeg**. Encoding and segment writing
continue for the entire broadcast; only the viewer's published playlist is
held back. See the contract document for why.

---

## Configuration

Environment variables (at `packages/media-server/.env` or repo root `.env`).
See [`.env.staging.example`](./.env.staging.example) and
[`.env.production.example`](./.env.production.example) for the full,
commented list. Infisical is the source of truth for real values — the
`.example` files hold no secrets.

| Variable                  | Purpose                                                         | Default                  |
| ------------------------- | --------------------------------------------------------------- | ------------------------ |
| `MEDIA_PORT`              | HTTP + Socket.IO port                                           | `8000`                   |
| `DATABASE_URL`            | Postgres connection (Prisma) — required for the catch-up buffer | —                        |
| `JWT_SECRET`              | Validates socket connections; must match the app-server         | —                        |
| `INTERNAL_SERVICE_SECRET` | Auth for the internal app-server ↔ media-server channel         | —                        |
| `APP_SERVER_URL`          | App-server target for internal calls (SCRUM-346)                | `http://app-server:8080` |
| `ANNOUNCED_IP`            | Public IP announced for WebRTC ICE — **must** be public in prod | `127.0.0.1`              |
| `RTC_MIN_PORT`            | Low end of the WebRTC UDP port range                            | `10000`                  |
| `RTC_MAX_PORT`            | High end of the WebRTC UDP port range                           | `10079`                  |

`DATABASE_URL` is required: the media server reads the `Stream` record
directly to drive the catch-up buffer.

FFmpeg output settings live in `src/services/ffmpeg.service.js`. The HLS
retention flags in `HLS_OUTPUT_CONFIG` are load-bearing for the catch-up
buffer — read the contract document before changing them.

---

## Inspecting Stream Files

```bash
docker compose exec media-server ls -R public/streams
```

Each active stream has a directory under `public/streams/<streamId>/`
containing `index.m3u8` (published), `source.m3u8` (raw FFmpeg output),
`input.sdp` and the `.ts` segments.

Segments are retained for the whole broadcast — see "Segment retention" in
the contract document — so a long stream's directory grows steadily and is
reclaimed only at teardown.

---

## Troubleshooting

| Issue                                  | Solution                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Transport not found`                  | Ensure `stream:create_transport` completes before `stream:produce`                            |
| `index.m3u8` returns 404               | Normal for the first few seconds — no segments yet. Persisting means FFmpeg failed to launch  |
| Viewer stuck on one frame              | Expected during a question. If it persists, check `Stream.status` is back to `LIVE`           |
| Viewer drifts further behind over time | By design — lag accumulates per question and is never recovered                               |
| Grid missing a participant             | Check the participant's role in the DB; only `HOST`/`PLAYER`/`MODERATOR` become HLS inputs    |
| `canConsume failed`                    | Consumer RTP capabilities must match producer codecs                                          |
| WebRTC ICE fails                       | Confirm `ANNOUNCED_IP` matches the server's public IP                                         |
| `RTP port pool exhausted`              | More concurrent inputs than the 11000–12999 pool allows; check for leaked streams             |
| High CPU                               | Compositing is the cost — reduce tile size in `ffmpeg.service.js` or enable hardware encoding |

---

## Integration

- **Client (participants)** — connects via Socket.IO, produces/consumes over WebRTC per role
- **Client (mass viewers, SCRUM-171)** — pulls `index.m3u8` only; see the contract document
- **App-Server** — creates stream records, validates roles via `gameParticipant`, and writes the freeze state (`status` / `lastPausedAt` / `accumulatedPauseMs`) that this package reads
- **Shared** — imports `SOCKET_EVENTS.STREAM` and `ERROR_MESSAGES`

---

## Testing (SCRUM-250)

### Running locally

```bash
cd packages/media-server
npm install        # installs vitest as devDependency
npm test           # runs all suites
```

Windows (PowerShell) — identical, npm scripts are cross-platform:

```powershell
cd packages\media-server
npm install
npm test
```

Focused run (single suite):

```bash
npx vitest run src/tests/stream_handler_participant_cap.test.js
```

Watch mode during development:

```bash
npx vitest
```

### Test suites

| File                                          | Covers                                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `stream.handler.consume.test.js`              | `stream:consume` / `stream:resume`                                                                                                 |
| `stream.handler.disconnect.test.js`           | Cleanup on socket disconnect and graceful `stream:ended`                                                                           |
| `stream.handler.producer-roles.test.js`       | `stream:produce` roles, `stream:new_producer`, `stream:join`                                                                       |
| `stream_handler_seed_consume.test.js`         | Viewer joining an active room seeds `currentProducers` and consumes each one                                                       |
| `stream_handler_participant_cap.test.js`      | 4-player cap (HOST+PLAYER only; MODERATOR/VIEWER excluded)                                                                         |
| `port-pool.service.test.js`                   | RTP port allocate/release/exhaustion                                                                                               |
| `ffmpeg.service.test.js`                      | Video grid, moderator overlay, audio mix, segment retention                                                                        |
| `ffmpeg.service.relaunch.integration.test.js` | Real FFmpeg process — segment numbering survives a roster relaunch (skipped automatically when the `ffmpeg` binary is unavailable) |
| `hls-playlist.service.test.js`                | Catch-up buffer publishing (`index.m3u8`)                                                                                          |
| `stream.service.multi-input.test.js`          | Per-participant media resource tracking                                                                                            |
| `stream.service.port-pool.test.js`            | Port allocation through `StreamService`                                                                                            |
| `stream.service.relaunch.test.js`             | Roster-change relaunch orchestration (AC2)                                                                                         |

### Running in CI

GitHub Actions workflow: `.github/workflows/media-server-tests.yml`
(job: **Run Media Server Test Suite**). Triggers on any PR touching
`packages/media-server/**` or `packages/shared/**`, and on pushes to `main`.

No database service is spun up — every test mocks `@prisma/client` and
`mediasoup` directly, so there's nothing to seed or reset between runs.

### Note on "Android, not iOS"

The original ticket's Definition of Done asked for run instructions
"אנדרואיד/סקריפט, לא iOS." This suite is entirely server-side (Socket.IO +
mocked mediasoup) and has no Android or iOS build step — the commands above
run identically on any OS, including Windows dev machines and the Linux CI
runner. If this note was meant to also cover an Android _client_ smoke test
against a live media-server, that's out of scope for this PR and should be
tracked as a separate follow-up ticket.

---

_Last updated: 2026-08-13_
