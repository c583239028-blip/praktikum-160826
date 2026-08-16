# Media Server Package — `@worldplay/media-server`

Located at `packages/media-server`. Handles live WebRTC media routing via **Mediasoup** (SFU) and records streams to HLS via **FFmpeg**. Exposes a Socket.IO interface used by the client.

**Port:** `8000` (HTTP + Socket.IO) | **UDP:** `10000–10010`, `11000–11020` (WebRTC) | **Node:** `>=24.0.0 <25`

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
index.js                          # Express + Socket.IO server init
src/
  config.js                       # Mediasoup worker/router options, port ranges
  controllers/
    streamController.js           # Socket event handlers (thin layer over services)
  middleware/
    socketAuth.js                 # JWT validation on socket connect
  routes/
    status.routes.js              # GET /status health check
  services/
    mediasoup.service.js          # Worker, router, transport, producer/consumer setup
    stream.service.js             # Room state + lifecycle management
    ffmpeg.service.js             # FFmpeg process management (HLS transcoding)
  sockets/
    stream.handler.js             # Socket.IO event wiring
  utils/
    logger.js                     # Structured logging
```

---

## Dual-Stream Architecture

Each broadcast creates **two independent Mediasoup routers**:

| Stream          | Role             | Behaviour                          |
| --------------- | ---------------- | ---------------------------------- |
| **Moderator**   | `MODERATOR`      | Always live — never paused         |
| **Host/Player** | `HOST`, `PLAYER` | Recordable — can be paused/resumed |

This separation lets the moderator continue monitoring while the game pauses the host/player feed.

---

## Socket.IO Events

Event names are defined in `@worldplay/shared` (`SOCKET_EVENTS.STREAM`).

### Setup

| Event                      | Purpose                                |
| -------------------------- | -------------------------------------- |
| `stream:init_broadcast`    | Create stream record, allocate routers |
| `stream:create_room`       | Init Mediasoup room (two routers)      |
| `stream:create_transport`  | Create WebRTC send/recv transport      |
| `stream:connect_transport` | Complete DTLS handshake                |

### Media

| Event                    | Purpose                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `stream:produce`         | Register producer; role determines router assignment + starts FFmpeg for HOST/PLAYER |
| `stream:consume`         | Request media from a router                                                          |
| `stream:join`            | Join broadcast and negotiate capabilities                                            |
| `stream:start_recording` | Explicitly start HLS recording                                                       |
| `stream:ended`           | Teardown — close routers, stop FFmpeg, mark stream FINISHED                          |

---

## Stream Lifecycle

```
stream:init_broadcast
  → DB record created (INITIALIZING)

stream:create_room
  → Two Mediasoup routers allocated (MODERATOR | HOST/PLAYER)

stream:produce (role = MODERATOR)
  → Producer added to MODERATOR router

stream:produce (role = HOST or PLAYER)
  → Producer added to HOST/PLAYER router
  → FFmpeg launched for HLS recording

Game pause event (from app-server)
  → HOST/PLAYER FFmpeg paused
  → MODERATOR router unaffected

Game resume event
  → FFmpeg resumed, recording continues

stream:ended
  → All routers closed
  → FFmpeg processes stopped
  → DB status → FINISHED
```

---

## Configuration

Environment variables (at repo root `.env`):

```
MEDIA_PORT=8000
TOKEN_SECRET=<jwt-secret>
DATABASE_URL=postgresql://...
ANNOUNCED_IP=<public IP for WebRTC ICE>
RTC_MIN_PORT=10000
RTC_MAX_PORT=10010
```

FFmpeg output settings are in `src/services/ffmpeg.service.js` — adjust `SEGMENT_DURATION` and bitrate targets for your use case.

---

## Inspecting Stream Files

```bash
docker compose exec media-server ls -R public/streams
```

HLS segments land in `public/streams/<streamId>/`.

---

## Troubleshooting

| Issue                                 | Solution                                                                |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `Transport not found`                 | Ensure `stream:create_transport` completes before `stream:produce`      |
| Moderator stream pauses on game pause | Verify MODERATOR and HOST/PLAYER routers are separate objects           |
| FFmpeg not recording                  | Check participant role in DB — must be HOST or PLAYER                   |
| `canConsume failed`                   | Consumer RTP capabilities must match producer codecs                    |
| WebRTC ICE fails                      | Confirm `ANNOUNCED_IP` matches the server's public IP                   |
| High CPU                              | Lower FFmpeg bitrate in `ffmpeg.service.js` or enable hardware encoding |

---

## Integration

- **Client** — connects via Socket.IO, produces/consumes per role
- **App-Server** — triggers pause/resume events, validates roles via `gameParticipant` DB records
- **Shared** — imports `SOCKET_EVENTS.STREAM` for typed event names and shared enums

---

_Last updated: 2026-06-08_
