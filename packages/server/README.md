# Server Package — `@worldplay/server`

Located at `packages/server`. This is the primary API and game orchestration service: REST endpoints, Socket.IO real-time events, Prisma/PostgreSQL persistence, in-app purchase (IAP) receipt validation, Firebase Admin, and social auth.

**Port:** `8080` | **Node:** `>=24.0.0 <25` | **Secrets:** Infisical

---

## Running

```bash
# With Infisical (recommended for dev)
npm run dev           # nodemon + infisical

# Without Infisical (requires local .env)
npm run dev:local

# Production
npm run start:cloud   # node src/index.js (no infisical)
```

---

## Source Layout

```
src/
  index.js                     # Entry point — HTTP server + Socket.IO
  app.js                       # Express app setup, CORS, routes
  config/
    corsOptions.js
    firebase.js                # Firebase Admin SDK init
    prisma.js                  # Prisma client singleton
    validateEnv.js             # Startup env validation
  constants/
    gameRules.js
  controller/                  # HTTP request handlers
    analytics.controller.js
    auth.controller.js
    chat.controller.js
    economy.controller.js
    feed.controller.js
    finance.controller.js
    follow.controller.js
    game.controller.js
    inbox.controller.js
    notification.controller.js
    question.controller.js
    stream.controller.js
    user.controller.js
    userAnswer.controller.js
  jobs/
    cleanup.job.js             # Scheduled cleanup tasks (node-cron)
  middleware/
    auth.middleware.js         # JWT auth guard
  routes/                      # Express routers (one per domain)
    analytics.routes.js
    auth.routes.js
    chat.routes.js
    config.routes.js
    economy.routes.js
    feed.routes.js
    finance.routes.js
    follow.routes.js
    games.routes.js
    gift.routes.js
    inbox.routes.js
    notification.routes.js
    question.routes.js
    status.routes.js
    stream.routes.js
    user.routes.js
    userAnswer.routes.js
  services/                    # Business logic
    analytics.service.js
    auth.service.js
    chat.service.js
    economy.service.js
    feed.service.js
    finance.service.js
    follow.service.js
    game.service.js
    inbox.service.js
    notification.service.js
    permissions.service.js
    question.service.js
    socket.service.js
    stream.service.js
    user.service.js
    userAnswer.service.js
```

---

## API Routes

### Auth

- `POST /api/auth/register` — Register with email/password
- `POST /api/auth/login` — Email/password login
- `POST /api/auth/logout`
- `POST /api/auth/verify` — Verify JWT token
- `POST /api/auth/social` — Social login (Google / Apple via Firebase ID token)

### Users

- `GET /api/users/me` — Current user profile
- `PUT /api/users/me` — Update profile
- `PATCH /api/users/me/birthday` — Set birthday
- `GET /api/users/:id` — Public user profile

### Follow / Social

- `POST /api/follow/:id` — Follow a user
- `DELETE /api/follow/:id` — Unfollow
- `GET /api/follow/:id/followers` — Follower list
- `GET /api/follow/:id/following` — Following list

### Feed

- `GET /api/feed` — Live/upcoming streams for the authenticated user

### Streams

- `POST /api/streams` — Create broadcast record
- `GET /api/streams/:id` — Stream details
- `GET /api/streams` — User's stream history
- `PATCH /api/streams/:id/status` — Update stream status
- `PATCH /api/streams/:id/pause` — Pause host/player stream
- `PATCH /api/streams/:id/resume` — Resume paused stream

### Games

- `POST /api/games` — Create game session
- `GET /api/games/:id` — Game details + participants
- `PATCH /api/games/:id/start` — Start game
- `PATCH /api/games/:id/pause` — Pause game
- `PATCH /api/games/:id/resume` — Resume game
- `PATCH /api/games/:id/finish` — End game session

### Questions & Answers

- `GET /api/questions` — List questions
- `POST /api/questions` — Create question
- `POST /api/questions/:id/answers` — Submit answer

### Chat & Notifications

- `GET /api/chat/:streamId` — Chat history for a broadcast
- `POST /api/chat` — Send chat message
- `GET /api/notifications` — User notifications
- `POST /api/notifications/:id/read` — Mark as read

### Inbox

- `GET /api/inbox` — Direct messages
- `POST /api/inbox` — Send message

### Finance & Economy

- `GET /api/finance/balance` — Wallet balance
- `GET /api/finance/transactions` — Transaction history
- `GET /api/economy/...` — In-app economy (gifts, coins)

> **Payments:** coins are bought via **platform IAP** (Apple/Google), validated server-side — **no Stripe** (removed; see `docs/spec/SPEC.md` §12). The IAP receipt-validation endpoint is part of the wallet build (§9, not yet implemented).

### Gifts

- `POST /api/gifts/send` — Send a gift during stream

### Analytics

- `GET /api/analytics/...` — Stream and game analytics

### Config & Status

- `GET /api/config/media-server` — Media-server connection config for clients
- `GET /api/config/app-settings` — Feature flags / app settings
- `GET /` — Service health check (returns `{ status: "online", ... }`)

---

## Socket.IO Events

Event names are defined in `@worldplay/shared` (`SOCKET_EVENTS`).

### Game Events

| Event                       | Direction     | Description                     |
| --------------------------- | ------------- | ------------------------------- |
| `game:create`               | client→server | Create a game room              |
| `game:join_room`            | client→server | Join game as host/player/viewer |
| `game:place_bet`            | client→server | Submit a wager                  |
| `game:status_update`        | server→client | Game state changed              |
| `game:room_update`          | server→client | Room participants changed       |
| `game:invite_moderator`     | client→server | Invite moderator to game        |
| `game:moderator_invitation` | server→client | Moderator receives invite       |
| `game:moderator_response`   | client→server | Accept/reject moderator invite  |

### Wallet Events

| Event            | Direction     | Description                 |
| ---------------- | ------------- | --------------------------- |
| `balance_update` | server→client | Push updated wallet balance |

---

## Database (Prisma / PostgreSQL)

Schema: [prisma/schema.prisma](prisma/schema.prisma)

### Key Models

| Model             | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `User`            | Accounts, Firebase UID, birthday, social profile              |
| `Stream`          | Broadcast records — `INITIALIZING → LIVE → PAUSED → FINISHED` |
| `Game`            | Game session, pause fields, status                            |
| `GameParticipant` | Roles per game: HOST, PLAYER, MODERATOR, VIEWER               |
| `Question`        | Trivia questions with options                                 |
| `UserAnswer`      | Answer submissions with timestamps and wager                  |
| `Chat`            | Per-stream chat messages                                      |
| `Notification`    | Real-time notifications                                       |
| `Transaction`     | Purchase (IAP) & economy ledger                               |
| `Follow`          | User follow relationships                                     |
| `Inbox`           | Direct messages                                               |

### Prisma Commands

```bash
# Generate client
npx prisma generate

# Create migration
npx prisma migrate dev --name <name>

# Apply to prod
npx prisma migrate deploy

# Reset DB (dev only)
npx prisma migrate reset

# Visual browser
npx prisma studio
```

Or via npm scripts at repo root: `npm run migrate`, `npm run db:push`, `npm run db:seed`.

---

## Authentication

- **Email/password** — bcrypt + JWT
- **Social (Google / Apple)** — Firebase ID token verified via Firebase Admin SDK → JWT issued
- **Facebook** — removed (PR #67, Jun 5 2026); planned for Sprint 5

---

## Scheduled Jobs

`jobs/cleanup.job.js` — runs via `node-cron`. Cleans up stale stream records and expired sessions.

---

## Code Quality

```bash
npm run lint        # ESLint check
npm run lint:fix    # ESLint auto-fix
npm run format      # Prettier
```

Pre-commit hooks (Husky + lint-staged) run ESLint on staged files automatically.

---

## Docker

The service is `app-server` in `docker-compose.yml` at repo root.

```bash
# From repo root
npm run docker:up          # start all services
npm run logs:app           # tail app-server logs
docker compose exec app-server sh   # shell into container
```

---

For more details:

- [Media Server](../media-server/README.md)
- [Client](../client/README.md)
- [Shared](../shared/README.md)
- [Database Schema](prisma/schema.prisma)

_Last updated: 2026-06-08_

## Testing

### Running Tests

```bash
# From packages/server
npm test
```

### Test Structure

```
packages/server/
  __mocks__/
    firebase-admin.js     # Firebase Admin mock — no real credentials needed
  src/
    tests/
      birthday.test.js    # Example: updateBirthday controller
  vitest.config.js
```

### How to Write a Test

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { myController } from '../controller/my.controller.js';

vi.mock('@prisma/client', () => {
  const mockMethod = vi.fn();
  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      myModel: { myMethod: mockMethod },
    })),
  };
});

vi.mock('firebase-admin');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('myController', () => {
  it('200 — success case', async () => {
    const req = { body: { field: 'value' }, user: { id: 'user-1' } };
    const res = mockRes();
    await myController(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' })
    );
  });
});
```

### Database Strategy

Tests never touch the real database — all Prisma calls are mocked via `vi.mock('@prisma/client')`.
For integration tests in CI, use a separate test database defined in `.env.test`.
