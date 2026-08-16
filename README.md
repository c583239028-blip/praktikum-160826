# HyPulse MonoRepo

**HyPulse** is a real-time interactive live-streaming trivia platform. This monorepo contains all major components under `packages/`, enabling shared code, synchronized versioning, and unified dev workflows.

---

## Structure

```
docker-compose.yml
packages/
  client/           # Expo / React Native frontend (iOS, Android)
  media-server/     # WebRTC SFU (Mediasoup) + FFmpeg HLS recording
  server/           # Node/Express API, game logic, Socket.IO, Prisma/PostgreSQL
  shared/           # Shared Zod schemas + Socket.IO event constants
```

---

## Prerequisites

- **Node.js v24** (required by server and media-server)
- **Docker & Docker Compose**
- **Infisical CLI** — used for secret injection in dev/deploy

---

## Getting Started

### 1. Install dependencies

```bash
npm install       # at repo root installs all workspace packages
```

### 2. Authenticate with Infisical

```bash
infisical login
```

### 3. Start full stack

```bash
npm run docker:up     # exports .env via Infisical then runs docker compose
```

> **Use `npm run docker:up`, not a raw `docker compose up`.** The local DB port
> (5432) is published via `docker-compose.local.yml`, which is opt-in and *not*
> auto-loaded (renamed from `.override.yml` so it can never leak to production —
> SCRUM-292). The npm scripts pass it with `-f` for you; a raw `docker compose up`
> will not expose 5432 to the host.

This starts:

- `db` — PostgreSQL 15
- `app-server` — API & game backend (port 8080)
- `media-server` — Mediasoup + FFmpeg (port 8000, UDP 10000–10020)

`prisma-studio` (Visual DB browser) is opt-in and not started by `docker:up`:
run `docker compose --profile studio up -d prisma-studio`. It binds to
`127.0.0.1:5556`, reachable only via an SSH tunnel to the host.

### 4. Individual package development

```bash
npm run dev:server    # packages/server with nodemon + Infisical
npm run dev:media     # packages/media-server
cd packages/client && npm start   # Expo dev server
```

---

## Package Overview

| Package        | Purpose                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `client`       | Expo mobile app — feed, auth, game screens, WebRTC, design system        |
| `media-server` | Mediasoup SFU + FFmpeg HLS — dual-stream architecture with pause logic   |
| `server`       | REST API, Socket.IO, Prisma migrations, in-app purchases (IAP), social auth, analytics |
| `shared`       | Zod validation schemas + typed Socket.IO event name constants            |

---

## Root Scripts

| Script                    | What it does                                              |
| ------------------------- | --------------------------------------------------------- |
| `docker:up`               | Export secrets via Infisical → `docker compose up -d`     |
| `docker:down`             | Stop all containers                                       |
| `docker:rebuild`          | Export secrets → `docker compose up --build`              |
| `docker:logs`             | Tail all container logs                                   |
| `logs:app`                | Tail app-server logs only                                 |
| `logs:media`              | Tail media-server logs only                               |
| `migrate`                 | Run `prisma migrate dev` inside the running app container |
| `db:push`                 | Run `prisma db push` inside the running app container     |
| `db:seed`                 | Run `prisma db seed` inside the running app container     |
| `studio`                  | Open Prisma Studio on port 5556                           |
| `lint` / `lint:fix`       | ESLint across all packages                                |
| `format` / `format:check` | Prettier across all packages (write / verify)             |

---

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for coding conventions (naming, SRP, DRY) and how the lint/format tooling is enforced.

**Before opening a PR**, run through the systemic self-review checklist in [CHECKLIST.md](docs/CHECKLIST.md) — it covers which layers your change touches, DB/migrations, error handling, real-time/media, roles & authorization, secrets, whether new infra has a real consumer, and quality. The matching fill-in form **auto-populates every new PR's description** from `.github/pull_request_template.md`: answer it inside the PR description (not as a committed file), so there are no merge conflicts and no documents pile up in the repo. New team members: start from [ONBOARDING.md](docs/ONBOARDING.md).

---

## Environment Variables

Secrets are managed via **Infisical**. For local dev, `docker:up` and `docker:rebuild` auto-export a `.env` file at the repo root. Never commit `.env` to git.

Key variables used across packages:

```
PORT=8080
MEDIA_PORT=8000
DATABASE_URL=postgresql://...
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
TOKEN_SECRET
FIREBASE_* (service account config)
ANNOUNCED_IP          # media-server WebRTC announced IP
```

---

## Notes

- Workspace packages reference each other via `"file:../shared"` — no publishing required.
- Run `npx prisma generate` after schema changes, or use `npm run migrate`.
- The `_planning/` directory is gitignored — internal sprint planning for the team lead only.

---

_Last updated: 2026-07-29_
