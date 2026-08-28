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
│   │   ├── models/              user, otp, loginHistory, invalidatedToken, todo
│   │   ├── routes/              auth.routes, todo.routes
│   │   ├── services/            token.service, otp.service
│   │   ├── utils/               jwt, password, otp, mailer, captcha, history…
│   │   └── validations/         all Zod schemas
└── Frontend/                    React 19 + Tailwind v4 (Vite)
    └── src/
        ├── api/client.js        axios + bearer + silent refresh + CSRF echo
        ├── context/             AuthProvider / useAuth
        ├── components/          AuthLayout, ProtectedRoute, PublicRoute,
        │                        PasswordStrength, Spinner
        └── pages/               Login, Register, VerifyOtp,
                                 ForgotPassword, ResetPassword, Todos
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
| POST | `/api/auth/login` | — | email **or** phone · rememberMe · may return `twoFactorRequired` |
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
