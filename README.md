# SecureTodo — Full-Stack Todo App with Production-Grade Auth

A React + Tailwind todo application backed by a hardened Node/Express API:
JWT access/refresh rotation, email OTP verification, optional two-factor
login, device session management, password reset, and a full audit trail.

```
Todo-App/
├── .gitignore                    ignores node_modules/, dist/, .env.*, *.pem, …
├── backend/                     Express API (ES modules)
│   ├── server.js                entry point
│   ├── src/
│   │   ├── app.js               middleware pipeline + routes
│   │   ├── config/              env.js, db.js
│   │   ├── controllers/         auth, todos, admin
│   │   ├── middleware/          auth, csrf, validate, rateLimiter, sanitize, error
│   │   ├── models/              user, otp, loginHistory, invalidatedToken, todo,
│   │   │                        adminAuditLog, rateLimitLog
│   │   ├── routes/              auth.routes, todo.routes, admin.routes
│   │   ├── services/            token.service, otp.service
│   │   ├── utils/               jwt, password, otp, mailer, captcha, history,
│   │   │                        adminAudit…
│   │   └── validations/         all Zod schemas
└── Frontend/                    React 19 + Tailwind v4 (Vite)
    └── src/
        ├── api/client.js        axios + bearer + silent refresh + CSRF echo
        ├── context/             AuthProvider / useAuth
        ├── components/          AuthLayout, ProtectedRoute, PublicRoute,
        │                        AdminProtectedRoute (role-gated), AdminLayout,
        │                        UserLayout, TodoCompose, TodoForm, TodoCard,
        │                        ThemePicker, ReminderPicker, ListEditor,
        │                        PasswordStrength, Spinner, admin/ (ui kit, utils)
        └── pages/               Login, Register, VerifyOtp,
                                 ForgotPassword, ResetPassword, Todos, Reminders,
                                 Archives, Profile
                                 admin/ (Dashboard, Users, UserDetail, Security,
                                 Todos, Audit) — lazy-loaded
```

## Quick start

```bash
# 1. Backend — port 5050 (8080 is commonly taken)
cd backend
npm install
# .env already exists — edit MONGO_URI + JWT secrets (optional SMTP) there
npm run dev                   # http://localhost:5050

# 2. Frontend — another terminal
cd Frontend
npm install
npm run dev                   # http://localhost:5173
```

The frontend has **no env files** — the API URL is set in
`Frontend/src/api/client.js` (`API_BASE_URL`), and the reCAPTCHA site key in
`Frontend/src/utils/captcha.js`. Change them there when deploying.

### Environment variables (backend/.env)

The backend reads everything from `backend/.env`. Highlights:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string (local or Atlas) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | signing keys (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `JWT_REFRESH_EXPIRES_IN` / `JWT_REFRESH_REMEMBER_EXPIRES_IN` | 7d standard · 30d "Remember me" |
| `SMTP_HOST/PORT/USER/PASS` | real OTP emails; **leave empty in dev to get `devOtp` in responses** |
| `RECAPTCHA_SECRET_KEY` | enforce reCAPTCHA v3 on register/login (empty = off) |
| `MAX_FAILED_LOGIN_ATTEMPTS` / `LOCK_TIME_MINUTES` | lockout policy (5 tries → 60 min) |
| `*_RATE_LIMIT_*` | per-endpoint budgets |

> Dev shortcut: with `SMTP_HOST=""`, register/login-2FA/forgot-password
> responses include `devOtp` so you can finish flows without an inbox.
> This shortcut is disabled automatically in production.

## Feature map

**Login flow**
- Email **or phone** + password · show/hide password · Remember Me (30-day cookie)
- Account lockout: 5 failed attempts → locked 60 minutes (HTTP 423)
- Optional 2FA: after the password step a code is emailed;
  `POST /api/auth/verify-login-otp` completes sign-in (toggle via `PATCH /2fa`)
- Suspicious-login alerts: first sign-in from a new IP/device emails the user
- Every attempt is written to `loginhistories` (IP, user-agent, status)

**Sessions & logout**
- `GET /sessions` lists active devices (IP, device label, remembered?, current badge)
- `DELETE /sessions/:id` revokes one device remotely
- Logout blacklists the presented refresh token forever (replay = 401)
- Logout-all revokes + blacklists every session

**Password reset**
- `forgot-password` → single-use 10-min code (generic response, no enumeration)
- `reset-password` → new hashed password + ALL sessions invalidated

**Security stack**
- Helmet headers, CORS allow-list (credentials), HTTPS redirect in production
- Rate limits: register 5/h · auth 20/15min · forgot/reset 5/h · API 300/15min
- CSRF double-submit cookie guarding cookie-authenticated mutations
- Zod validation everywhere; NoSQL/XSS input sanitizer; bcrypt(12)
- Refresh tokens stored as SHA-256 hashes, rotated on use; replay of a
  rotated token triggers theft response (revoke everything)
- Role-based access: `requireAuth` + `authorize("admin")`
- Unified login + Admin Monitor panel: an admin promotes a user to
  `role: "admin"` in MongoDB and stores a **bcrypt-hashed admin code** on
  their account; the login page is **captcha-only** in the UI, but the
  backend silently also accepts `ADM-XXXX-XXXX` in the same verification
  field, yielding a `role: "admin"` session token. The admin ui gives no
  hint that a code exists.
- Global error handler — no stack traces leak in production

**JWT strategy**
- Access token: 15 min, returned in body, held in memory only (XSS-safe)
- Refresh token: httpOnly + secure(prod) + sameSite cookie scoped to `/api/auth`,
  one row per device; axios interceptor refreshes once and replays on 401

**Frontend UX**
- Unified "Aurora" theme (Tailwind v4 `@theme` tokens: brand violet, accent cyan, ink navy)
- Split-screen auth layout · inline field errors with red/green borders
- zxcvbn live password strength meter · react-hot-toast notifications
- Loading spinners in buttons · resend-code cooldown · devOtp banner

**Todo workspace**
- **Persistent navbar** — a shared `UserLayout` keeps the top bar mounted; tab
  clicks swap only the content area (no full page/navbar re-render), and Todo /
  Reminders / Archives / Profile pages are lazy-loaded for a faster first paint.
- **Compose box** — professional "Title..." input with a paragraph description
  below. Auto-saves while typing (debounced) and supports a **list mode**:
  click **"Start a list"** (or press `Shift + Enter`) to switch to diamond-bullet
  list items — a single `Enter` moves to the next item, and pressing `Enter` a
  second time on an empty item **keeps the list typed so far** and drops back to
  a normal continuing paragraph. List items are stored in the description with a
  `[ ] ` / `[x] ` line prefix (legacy `• ` lines still work) — saved to the
  database, so the **list marking persists** and the exact typed order is kept:
  paragraphs and lists render **in the order you typed them**, never regrouped.
  Every list item is a **marking box** (checkbox) on the cards and in the editor —
  clicking it ticks that single item (tick + line-through) **without changing the
  card's opacity**; only completing the whole task fades the card.
- **8 themes + None** (`ThemePicker`): None (no theme), Light (solid white card),
  Dark, Love, Simple, Forest, Ocean, Sunset, Violet — picked as a colored card
  background from the options menu. Every themed surface (cards, compose box,
  edit modal) adapts its text contrast so the **Light/white** theme is fully
  readable, and the theme washes are opaque enough that the accent color shows
  clearly.
- **Pin to top** — a distinct glowing toggle button on the compose box, edit
  modal and each card (ribbon badge on pinned cards).
- **Reminder picker** — a built-in calendar (past dates disabled) plus a
  12-hour clock with minute + AM/PM selectors. Only **future** times are
  accepted (validated client-side and again on the API); the **Done** button
  closes the picker after a valid future time is set.
- **Full lifecycle record** — the todo document tracks `lastEditedAt`,
  `deletedAt`, `archivedAt`, `restoredAt`, `reminderSentAt` and a capped
  `history[]` array (create, edit, complete, archive/restore, delete,
  reminder set/sent) so admins can analyse how tasks evolve over time.
  `GET /api/admin/todos` returns these fields on every row.
- **Archives** — archive any task from the card action bar or the edit modal.
  Archived tasks leave the main/reminder lists and live on the dedicated
  `/archives` page (navbar tab) where they can be restored or deleted.
- **Card quick actions** — pin, archive and delete sit directly on every card.
  On desktop they are hover-revealed (`lg:`), on touch/mobile they are always
  visible so no editor is needed.
- **Layout toggle** — under the compose box a Vertical / Horizontal switch
  (persisted in `localStorage`). Horizontal mode sizes the grid by card count:
  1 card = full width, 2 cards = two equal columns, 3+ cards = three equal
  columns, and a trailing partial row keeps the same width as the others
  (Archives uses the same responsive grid). Cards in a responsive grid also
  grow to fit their content — every card is **equal width** (the grid stretches
  them to `1fr`), but each card's **height follows its own content**. Descriptions
  are shown in full (no line-clamping) with a `max-h-40` cap that scrolls
  internally so no card grows unboundedly tall.

## Admin Monitoring Panel

There is **no separate admin login page** — admins use the exact same login
page as everyone else, and that page **looks purely like a todo app's**:

- **Normal user** → type the **visual captcha code** from the image.
- **Admin** → the UI shows nothing extra, but the backend also tries an
  exact bcrypt match of the typed value against that user's stored **admin
  code** (`ADM-XXXX-XXXX`) **first**, falls back to captcha validation
  otherwise, and the **password must still match**. A matching admin code
  yields a `role: "admin"` access token → you land in `/admin`. Every
  `/api/admin/*` route runs `requireAuth + authorize("admin")`, so the
  frontend role guard (`AdminProtectedRoute`) is UX only — the backend is
  the security boundary.

### Promote a user to admin

Promotion is done directly in MongoDB (no helper script ships in the repo):

1. Find the user in MongoDB (Compass/shell). Set `role: "admin"`.
2. Create a bcrypt hash of the code you'll give them (6-digit or
   `ADM-XXXX-XXXX`), e.g. from `backend/`:
   ```bash
   node -e "const b=require('bcryptjs');console.log(b.hashSync('ADM-MY-CODE',12))"
   ```
3. On that user, set `adminCode` to the hash and `adminCodeSetAt` to now.
   Give the plaintext code to the admin separately — it is never stored in
   plaintext.
4. The admin types that code into the login verification field to reach
   the panel. (An admin who instead uses the captcha signs in as a normal
   user and cannot open the admin panel.)

### What the panel monitors

All admin pages share a dark "liquid-glass" slate theme, auto-refresh
every 30s, surface toasts for every action, and gate destructive actions
behind confirmation modals.

- **Dashboard** — user/todo totals with day-over-day trend chips, signups
  over time, login success/failure trend, todos-by-status pie, system
  health + priority bars (recharts).
- **Users** — list/search/filter with sortable columns, lock/unlock,
  deactivate/reactivate, force sign-out, all with confirm modals + toasts.
- **User detail** (`/admin/users/:id`) — full profile, soft todo stats,
  security activity timeline, and per-session revoke.
- **Login & Security** — login-history table (CSV export), failed-attempt
  grouping by IP & user, all active sessions with per-session revoke,
  rate-limit hits, risky-activity alerts.
- **Todos** — all todos across users, status/priority stats, most-active
  users, recycle bin (restore or purge soft-deleted todos).
- **Audit Log** — every admin action (including `revoke_session`) is
  recorded in `AdminAuditLog`.

## Manual testing

Test each flow through the UI at http://localhost:5173 — register an
account, verify the emailed code (or use `devOtp` from the API response
when `SMTP_HOST` is empty in dev), then log in, create todos, refresh and
logout. No Postman or automated suite is required.

## API summary

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | — | 5/h/IP · captcha |
| POST | `/api/auth/verify-otp` | — | activates + logs in |
| POST | `/api/auth/resend-otp` | — | 60s cooldown |
| POST | `/api/auth/login` | — | email **or** phone · rememberMe · `verificationField` (captcha **or** admin code) · may return `twoFactorRequired` |
| POST | `/api/auth/verify-login-otp` | pendingToken | completes 2FA login |
| POST | `/api/auth/refresh-token` | cookie + CSRF | rotates pair |
| GET  | `/api/auth/me` | bearer | profile |
| GET  | `/api/auth/sessions` | bearer | active devices |
| DELETE | `/api/auth/sessions/:id` | bearer | revoke one device |
| PATCH | `/api/auth/2fa` | bearer | `{ enabled: bool }` |
| POST | `/api/auth/logout` | cookie + CSRF | blacklist this token |
| POST | `/api/auth/logout-all` | bearer | kill every session |
| POST | `/api/auth/forgot-password` | — | generic reply + code |
| POST | `/api/auth/reset-password` | — | new password, kills sessions |
| GET  | `/api/auth/admin/ping` | bearer + role | RBAC demo |
| GET  | `/api/todos` | bearer | active todos (excludes archived/deleted) |
| GET  | `/api/todos/reminders` | bearer | todos with future/past reminders |
| GET  | `/api/todos/archived` | bearer | archived todo list |
| POST | `/api/todos` | bearer | create todo (title, description, theme, pin, reminder…) |
| PATCH | `/api/todos/:id` | bearer | update todo |
| PATCH | `/api/todos/:id/toggle` | bearer | complete/undo |
| PATCH | `/api/todos/:id/archive` | bearer | archive a todo (unpins it) |
| PATCH | `/api/todos/:id/unarchive` | bearer | restore an archived todo |
| PATCH | `/api/todos/:id/reorder` | bearer | save drag-and-drop order |
| DELETE | `/api/todos/:id/attachments/:attachmentId` | bearer | remove one attachment |
| DELETE | `/api/todos/:id` | bearer | soft-delete a todo |
| GET  | `/api/admin/users` | admin | list + filter/search users |
| GET  | `/api/admin/users/:id` | admin | single user detail + activity |
| PATCH | `/api/admin/users/:id/lock` | admin | manually lock account |
| PATCH | `/api/admin/users/:id/unlock` | admin | manually unlock |
| PATCH | `/api/admin/users/:id/deactivate` | admin | deactivate account |
| PATCH | `/api/admin/users/:id/reactivate` | admin | reactivate account |
| DELETE | `/api/admin/users/:id/sessions` | admin | force logout (all sessions) |
| GET  | `/api/admin/users/:id/sessions` | admin | list user's active sessions |
| DELETE | `/api/admin/users/:id/sessions/:sessionId` | admin | revoke one of the user's sessions |
| GET  | `/api/admin/login-history` | admin | filterable login history |
| GET  | `/api/admin/login-history/failed` | admin | failures by IP/user |
| GET  | `/api/admin/sessions/active` | admin | all active sessions |
| GET  | `/api/admin/todos` | admin | all todos, filterable |
| GET  | `/api/admin/todos/stats` | admin | status/priority/user stats |
| GET  | `/api/admin/todos/deleted` | admin | recycle bin |
| PATCH | `/api/admin/todos/:id/restore` | admin | restore soft-deleted todo |
| DELETE | `/api/admin/todos/:id/purge` | admin | permanently delete |
| GET  | `/api/admin/stats/overview` | admin | dashboard summary |
| GET  | `/api/admin/stats/signups` | admin | signups over time |
| GET  | `/api/admin/stats/login-trend` | admin | login success/failure trend (`days`/`from`/`to`) |
| GET  | `/api/admin/stats/otp-usage` | admin | OTP sent vs verified |
| GET  | `/api/admin/stats/rate-limits` | admin | rate-limit hit log |
| GET  | `/api/admin/audit-log` | admin | admin actions log |
