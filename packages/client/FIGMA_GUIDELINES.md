# HyPulse — Figma Component & Icon Reference

> Figma file: **WorId Game (Shira)** — `FBQSv16ajir03ZAtRbuHxb`
> Direct link: https://www.figma.com/design/FBQSv16ajir03ZAtRbuHxb/WorId-Game--Shira-
>
> **Scope (restructured 2026-06-19):** this file now covers only what isn't tracked elsewhere —
> the **icon library**, **component node IDs**, **RTL convention**, and **Figma API notes**.
> For everything else use the canonical sources:
>
> - 🎨 **Design tokens (colors, typography, spacing, radius, gradients)** → [`constants/design.js`](constants/design.js) — **source of truth**.
> - 🗺️ **Screen inventory (every screen + node ID + screen number)** → [FIGMA-SCREENS.md](../../FIGMA-SCREENS.md).
> - 📋 **Product behavior** → [SPEC.md](../../SPEC.md).

---

## Table of Contents

1. [Figma file pages](#figma-file-pages)
2. [Icons](#icons)
3. [Component Conventions & node IDs](#component-conventions--node-ids)
4. [RTL / LTR Support](#rtl--ltr-support)
5. [Working with the Figma API](#working-with-the-figma-api)

---

## Figma file pages

| Page                | Node ID      | Purpose                              |
| ------------------- | ------------ | ------------------------------------ |
| Design              | `1:2`        | Exploration / scratch work           |
| **screens for dev** | `6619:11957` | Primary reference for implementation |
| Design system       | `4702:23825` | Colors, typography, components       |

> **Rule:** Always implement from **screens for dev** — never from the Design or Archive pages.
> The per-section / per-screen map (node IDs + screen numbers) lives in [FIGMA-SCREENS.md](../../FIGMA-SCREENS.md).

---

## Icons

### Naming Convention

All icons in the Design System follow the format: `icon/{name}` or `icon/{name}-{variant}`

### Icon Library

```
Navigation
  icon/home            icon/home-filled
  icon/message         icon/message-filled
  icon/user            icon/user-filled
  icon/live            (red, LIVE broadcast)
  icon/search

Actions
  icon/back            icon/close
  icon/arrow-right     icon/arrow-top
  icon/down-arrow      icon/up-arrow
  icon/share           icon/copy
  icon/edit            icon/send-filled
  icon/add question    icon/write question
  icon/more            icon/menu

Media
  icon/camera          icon/camera-off
  icon/speaker         icon/speaker_off (unspeaker)
  icon/eye             icon/close view
  icon/maximize        icon/video-library
  icon/loader-circle

Social
  icon/friends         icon/friends-filled
  icon/usergroup-add   icon/user-less
  icon/Followers       icon/blocked
  icon/report          icon/report-filled
  icon/bell            icon/notifications

Game / Live
  icon/questions       icon/person-question
  icon/waiting-question icon/write question 2
  icon/point           icon/gift-filled
  icon/correct         icon/In progress
  icon/clock-filled    icon/pause

Settings / Misc
  icon/settings        icon/exit
  icon/invite mendator icon/Moderator
  icon/suggest         icon/users
  icon/activity        icon/tracking
  icon/picture         icon/history
```

### Icon Usage Rules

- Always use the Design System icon — do not import external icon libraries for icons that exist here.
- Icon size: typically `20–24px`; nav bar icons `24px`; inline action icons `20px`.
- Icon color comes from `constants/design.js`: inactive → `Colors.text.secondary` (`#63656B`),
  active → `Colors.text.primary` (`#1F293B`) or `Colors.primary.default` (`#00E5FF`).

---

## Component Conventions & node IDs

### Naming Pattern

```
ComponentName                     — base component
ComponentName/VariantName         — variant
ComponentName/State/RTL=True      — with state + directionality
```

### Key Components

| Component                | Node ID      | Notes                         |
| ------------------------ | ------------ | ----------------------------- |
| `main nav`               | `6337:18144` | Bottom navigation bar         |
| `player nav`             | `6604:45749` | Player-specific nav           |
| `mendator nav`           | `6509:21470` | Moderator nav                 |
| `Host nav`               | `6783:29874` | Host nav                      |
| `viewer live window`     | `6366:20954` | Live stream card (StreamCard) |
| `mendator live window`   | `6340:23472` | Moderator's live view         |
| `Suggested Account Card` | `6382:20676` | Account suggestion card       |
| `Top Bar`                | `6288:33834` | Screen top bar                |
| `top-bar/HOST/mandator`  | `6490:17842` | Host/moderator top bar        |
| `Button-Circle`          | `6340:21510` | Circular action button        |
| `main button`            | `4773:6342`  | Primary CTA button            |
| `avatar`                 | `5051:9183`  | User avatar                   |
| `avatar-status`          | `5055:9700`  | Avatar with online status     |
| `Badge`                  | `5055:9585`  | Notification badge            |
| `Toast`                  | `6588:41763` | Toast notification            |
| `short toast`            | `6852:75466` | Short toast                   |
| `Progress Bar`           | `6544:35108` | Progress indicator            |
| `Radio Button`           | `6847:69014` | Radio button                  |
| `Switch`                 | `3357:5689`  | Toggle switch                 |
| `Text Field`             | `6371:19025` | Input field                   |
| `ChatPreview`            | `5055:9743`  | Chat preview row              |
| `tab`                    | `6386:23494` | Tab component                 |

---

## RTL / LTR Support

Every component that supports bidirectionality has two variants:

```
RTL = True    — Hebrew / Arabic (right-to-left)
RTL = False   — English (left-to-right)
```

**Rules:**

- Always check both variants exist before implementing.
- **Default UI direction is English / LTR, then auto-follow the device locale** (PM-confirmed 2026-06-18,
  see [SPEC.md §13](../../SPEC.md)). Supported beta languages: English + Hebrew. _(An earlier "default RTL/Hebrew"
  note here was superseded.)_
- When implementing, use React Native's `I18nManager.isRTL` to switch layout, and logical props
  (`paddingStart`/`marginEnd`) rather than hardcoded left/right.

---

## Working with the Figma API

### Authentication

```
Header: X-Figma-Token: <personal-access-token>
File key: FBQSv16ajir03ZAtRbuHxb
```

### Required Token Scopes

| Scope                  | Purpose               |
| ---------------------- | --------------------- |
| `current_user:read`    | Verify token          |
| `file_content:read`    | Read file nodes       |
| `file_metadata:read`   | Read file metadata    |
| `library_content:read` | Read published styles |

### Useful Endpoints

```bash
# Get a specific node
GET /v1/files/FBQSv16ajir03ZAtRbuHxb/nodes?ids={node-id}&depth=4

# Get rendered image of a node
GET /v1/images/FBQSv16ajir03ZAtRbuHxb?ids={node-id}&scale=2&format=png

# Get file structure
GET /v1/files/FBQSv16ajir03ZAtRbuHxb?depth=2
```

### Rate Limits

The `/files/{key}/nodes` endpoint has a strict rate limit (Viewer/Collaborator seats are lower —
~3 req/min). Wait 60+ seconds between heavy node fetches; batch IDs in one request (`?ids=id1,id2,id3`);
use the `/images` endpoint for visual checks (separate limit).

---

> Last updated: 2026-06-19 · Maintained by: Sara
> Token stored in: `~/.claude/settings.json` → `mcpServers.figma.args`
