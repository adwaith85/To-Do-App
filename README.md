# SecureTodo — Full-Stack Todo App with Production-Grade Auth

A React + Tailwind todo application backed by a hardened Node/Express API:
JWT access/refresh rotation, email OTP verification, optional two-factor
login, device session management, password reset, and a full audit trail.

```
Todo-App/
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
│   └── scripts/generateAdminCode.js   promote a user + mint an admin code
└── Frontend/                    React 19 + Tailwind v4 (Vite)
    └── src/
        ├── api/client.js        axios + bearer + silent refresh + CSRF echo
        ├── context/             AuthProvider / useAuth
        ├── components/          AuthLayout, ProtectedRoute, PublicRoute,
        │                        AdminRoute, AdminLayout, PasswordStrength, Spinner
        └── pages/               Login, Register, VerifyOtp,
                                 ForgotPassword, ResetPassword, Todos
                                 admin/ (Dashboard, Users, Security, Todos, Audit)
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
  `role: "admin"` in MongoDB and runs `node scripts/generateAdminCode.js`
  to mint a hashed **admin code**; admins then type `ADM-XXXX-XXXX` into
  the **same** login verification field (normally the captcha) to get an
  admin-session token and land in `/admin`. Format disambiguates the two.
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

## Admin Monitoring Panel

There is **no separate admin login page** — admins use the exact same login
page as everyone else. The role is decided purely by the verification field:

- **Normal user** → type the **visual captcha code** from the image.
- **Admin** → type their **admin code** (`ADM-XXXX-XXXX`). The backend tries
  an exact hash match against that user's stored code **first**, falls back
  to captcha validation otherwise, and the **password must still match**.
  A matching admin code yields a `role: "admin"` access token → you land in
  `/admin`. Every `/api/admin/*` route runs `requireAuth + authorize("admin")`.

### Promote a user to admin

1. Find the user in MongoDB (Compass/shell). Set `role: "admin"`.
2. Generate + hash an admin code (from `backend/`):
   ```bash
   node scripts/generateAdminCode.js <userId>          # random ADM-XXXX-XXXX
   node scripts/generateAdminCode.js <userId> ADM-MY-CODE   # your own
   ```
   It hashes the code with bcrypt into `user.adminCode` and prints the plain
   code **once**. Give it to the admin separately — it is never stored in
   plaintext.
3. The admin types that code into the login verification field to reach
   the panel. (An admin who instead uses the captcha signs in as a normal
   user and cannot open the admin panel.)

### What the panel monitors

- **Dashboard** — user/todo totals, signups over time, OTP usage, uptime.
- **Users** — list/search/filter, single-user profile + activity timeline,
  lock/unlock, deactivate/reactivate, force sign-out, active sessions.
- **Login & Security** — full login-history table, failed-attempt grouping
  by IP & user, active sessions, rate-limit hits.
- **Todos** — all todos across users, status/priority stats, most-active
  users, recycle bin (restore or purge soft-deleted todos).
- **Audit Log** — every admin action itself is recorded in `AdminAuditLog`.

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
| *    | `/api/todos…` | bearer | per-user CRUD |
| GET  | `/api/admin/users` | admin | list + filter/search users |
| GET  | `/api/admin/users/:id` | admin | single user detail + activity |
| PATCH | `/api/admin/users/:id/lock` | admin | manually lock account |
| PATCH | `/api/admin/users/:id/unlock` | admin | manually unlock |
| PATCH | `/api/admin/users/:id/deactivate` | admin | deactivate account |
| PATCH | `/api/admin/users/:id/reactivate` | admin | reactivate account |
| DELETE | `/api/admin/users/:id/sessions` | admin | force logout (all sessions) |
| GET  | `/api/admin/users/:id/sessions` | admin | list user's active sessions |
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
| GET  | `/api/admin/stats/otp-usage` | admin | OTP sent vs verified |
| GET  | `/api/admin/stats/rate-limits` | admin | rate-limit hit log |
| GET  | `/api/admin/audit-log` | admin | admin actions log |
