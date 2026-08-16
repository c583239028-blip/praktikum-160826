# Shared Package — `@worldplay/shared`

Located at `packages/shared`. A lightweight ESM package providing code shared across the monorepo — Zod validation schemas and typed Socket.IO event name constants.

---

## Contents

### Zod Schemas (`src/index.js`)

| Export               | Validates                                                                |
| -------------------- | ------------------------------------------------------------------------ |
| `CreateGameSchema`   | Room name (min 3 chars), max players (2–8), optional `isPrivate` flag    |
| `JoinGameSchema`     | UUID game ID, role enum (`HOST` / `PLAYER` / `VIEWER`, default `VIEWER`) |
| `SubmitAnswerSchema` | UUID question ID, UUID option ID, non-negative wager amount              |

These schemas are used on both the backend (request validation) and the client (form validation) to ensure both sides agree on the same rules.

### Socket Event Constants (`src/constants/socketEvents.js`)

`SOCKET_EVENTS` — a typed object with all Socket.IO event name strings used across packages:

```js
SOCKET_EVENTS.SYSTEM; // disconnect, error
SOCKET_EVENTS.WALLET; // balance_update
SOCKET_EVENTS.GAME; // game:create, game:join_room, game:place_bet, ...
SOCKET_EVENTS.STREAM; // stream:create_room, stream:produce, stream:consume, ...
```

Import from either package so event names stay in sync and never drift.

---

## Usage

```js
import {
  CreateGameSchema,
  JoinGameSchema,
  SOCKET_EVENTS,
} from '@worldplay/shared';

// Validate input
const result = CreateGameSchema.safeParse(req.body);

// Use typed event name
socket.emit(SOCKET_EVENTS.GAME.CREATE, payload);
```

Both `server` and `media-server` reference this package via `"file:../shared"` in their `package.json`. No build step or publishing required.

---

## Development

The package is plain ESM JavaScript — no transpilation needed. Edit `src/index.js` or `src/constants/socketEvents.js` and changes are immediately available to dependent packages within the monorepo.

> Keep shared logic minimal. If a dependency grows domain-specific, move it to the appropriate package instead.

---

_Last updated: 2026-06-08_
