/**
 * API smoke test — exercises the whole auth + todos flow with plain fetch.
 *
 * Run:  BASE=http://localhost:5050 node scripts/smoke-test.mjs
 *
 * The server should be started WITHOUT reCAPTCHA and WITH SMTP disabled so
 * devOtp codes are returned and captcha checks are skipped:
 *   RECAPTCHA_SECRET_KEY="" SMTP_HOST="" REGISTER_RATE_LIMIT_MAX=50 \
 *   AUTH_RATE_LIMIT_MAX=100 node server.js
 */
const BASE = process.env.BASE || "http://localhost:5050";

let passed = 0;
let failed = 0;

function check(name, condition, extra = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

/* ------------------------------------------------------------------ */
/* Cookie jar + request helpers                                        */
/* ------------------------------------------------------------------ */

/** Cookies the server has given us so far (refresh + csrf). */
const jar = { refresh: null, csrf: null };

function absorbCookies(setCookieHeader) {
  if (!setCookieHeader) return;
  const refresh = /refreshToken=[^;]+/.exec(setCookieHeader);
  const csrf = /csrfToken=[^;]+/.exec(setCookieHeader);
  if (refresh) jar.refresh = refresh[0];
  if (csrf) jar.csrf = csrf[0];
}

function maxAgeOf(setCookieHeader) {
  const m = /refreshToken=[^;]*; Max-Age=(\d+)/i.exec(setCookieHeader || "");
  return m ? parseInt(m[1], 10) : null;
}

/** Cookie header = whatever we pass + the csrf cookie for double-submit. */
function cookieHeader(explicit) {
  return [explicit, jar.csrf].filter(Boolean).join("; ") || undefined;
}

async function request(method, path, { body, token, cookie, ua, csrf = true } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(cookieHeader(cookie) && { Cookie: cookieHeader(cookie) }),
      // Double-submit CSRF: echo the readable cookie back as a header.
      ...(csrf && jar.csrf && { "x-csrf-token": jar.csrf.split("=")[1] }),
      ...(ua && { "User-Agent": ua }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  absorbCookies(res.headers.get("set-cookie"));
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") };
}

const post = (path, body, opts = {}) => request("POST", path, { body, ...opts });
const get = (path, token, opts = {}) => request("GET", path, { token, ...opts });
const patchJson = (path, body, token, opts = {}) =>
  request("PATCH", path, { body, token, ...opts });
const del = (path, token, opts = {}) => request("DELETE", path, { token, ...opts });

/* ------------------------------------------------------------------ */
console.log("\n=== 1. Validation & registration ===");
/* ------------------------------------------------------------------ */

{
  const r = await post("/api/auth/register", {
    name: "T", email: "bad-name@example.com", phone: "+919876543210", password: "Passw0rd!23",
  });
  check("register rejects short name", r.status === 400);
}

{
  const r = await post("/api/auth/register", {
    name: "Smoke Test", email: "smoke@example.com",
    phone: "+919876543210", password: "weakpass",
  });
  check("register rejects weak password", r.status === 400 &&
    /uppercase/i.test(r.data.message || ""));
}

{
  const r = await post("/api/auth/register", {
    name: "Smoke Test", email: "smoke@example.com",
    phone: "12345", password: "Passw0rd!23",
  });
  check("register rejects invalid phone digits", r.status === 400 &&
    /phone/i.test(r.data.message || ""));
}

const EMAIL = `smoke.tester.${Date.now()}@example.com`;
// Unique valid IN mobile per run (+91 + 9XXXXXXXXX) so reruns never clash.
const PHONE = `+919${String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0")}`;
const PASSWORD = "Passw0rd!23";
const NEW_PASSWORD = "FreshPass!456";
let devOtp = null;
let accessA = null;
let cookieA = null;

{
  const r = await post("/api/auth/register", {
    name: "Smoke Test", email: EMAIL, phone: PHONE, password: PASSWORD,
  });
  devOtp = r.data.devOtp;
  check("register succeeds (201)", r.status === 201, JSON.stringify(r.data));
  check("devOtp returned when SMTP off", typeof devOtp === "string" && /^\d{6}$/.test(devOtp));
  check("csrf cookie issued", Boolean(jar.csrf));
}

{
  const r = await post("/api/auth/register", {
    name: "Smoke Test", email: EMAIL, phone: PHONE, password: PASSWORD,
  });
  check("duplicate register → 409", r.status === 409);
}

/* ------------------------------------------------------------------ */
console.log("\n=== 2. OTP verification ===");
/* ------------------------------------------------------------------ */
{
  const r = await post("/api/auth/verify-otp", { email: EMAIL, otp: "000000" });
  check("wrong OTP rejected", r.status === 400);

  const ok = await post("/api/auth/verify-otp", { email: EMAIL, otp: devOtp });
  accessA = ok.data.data?.accessToken;
  cookieA = jar.refresh;
  check("correct OTP verifies & logs in", ok.status === 200 && Boolean(accessA), JSON.stringify(ok.data));
  check("refresh cookie set", Boolean(cookieA));

  const reused = await post("/api/auth/verify-otp", { email: EMAIL, otp: devOtp });
  check("OTP cannot be replayed", reused.status === 400 || reused.data.data?.alreadyVerified === true);
}

/* ------------------------------------------------------------------ */
console.log("\n=== 3. Protected routes & RBAC ===");
/* ------------------------------------------------------------------ */
{
  const anon = await get("/api/todos");
  check("todos without token → 401", anon.status === 401);

  const me = await get("/api/auth/me", accessA);
  check("GET /me returns profile", me.status === 200 && me.data.data?.user?.email === EMAIL);
  check("profile hides sensitive fields",
    !("password" in (me.data.data?.user || {})) &&
    !("refreshTokens" in (me.data.data?.user || {})));

  const ping = await get("/api/auth/admin/ping", accessA);
  check("authorize(role) blocks non-admin", ping.status === 403);
}

/* ------------------------------------------------------------------ */
console.log("\n=== 4. Todos CRUD ===");
/* ------------------------------------------------------------------ */
let todoId = null;
{
  const created = await post("/api/todos", { task: "Write smoke test" }, { token: accessA });
  todoId = created.data.data?._id;
  check("create todo", created.status === 201 && Boolean(todoId));

  const list = await get("/api/todos", accessA);
  check("list todos contains new item", list.status === 200 &&
    Array.isArray(list.data.data) && list.data.data.some((t) => t._id === todoId));

  const badId = await patchJson(`/api/todos/${"0".repeat(24)}`, undefined, accessA);
  check("toggle unknown id → 404", badId.status === 404);

  const toggled = await patchJson(`/api/todos/${todoId}`, undefined, accessA);
  check("toggle flips status", toggled.status === 200 && toggled.data.data?.status === "completed");

  const removed = await del(`/api/todos/${todoId}`, accessA);
  check("delete todo", removed.status === 200);
}

/* ------------------------------------------------------------------ */
console.log("\n=== 5. Refresh rotation ===");
/* ------------------------------------------------------------------ */
let cookieB = null;
{
  const r1 = await post("/api/auth/refresh-token", undefined, { cookie: cookieA });
  accessA = r1.data.data?.accessToken || accessA;
  cookieB = jar.refresh;
  check("rotation issues new pair", r1.status === 200 && Boolean(cookieB) && cookieB !== cookieA);

  // Replaying the OLD (rotated-away) cookie must trigger theft detection.
  const replay = await post("/api/auth/refresh-token", undefined, { cookie: cookieA });
  check("replayed rotated token revoked ALL sessions", replay.status === 401);

  // The NEWEST cookie is dead now too (all sessions were revoked).
  const newest = await post("/api/auth/refresh-token", undefined, { cookie: cookieB });
  check("post-revoke refresh denied", newest.status === 401);
}

/* ------------------------------------------------------------------ */
console.log("\n=== 6. Login: identifier types + Remember Me ===");
/* ------------------------------------------------------------------ */
let cookieC = null;   // standard 7-day session (email identifier)
let cookieD = null;   // remember-me 30-day session (PHONE identifier)
let accessD = null;
{
  const wrong = await post("/api/auth/login", { email: EMAIL, password: "WrongPass!99" });
  check("wrong password → 401", wrong.status === 401);

  const unknown = await post("/api/auth/login", {
    email: `unverified.${Date.now()}@example.com`, password: PASSWORD,
  });
  check("unknown email → same 401 wording", unknown.status === 401 &&
    unknown.data.message === wrong.data.message);

  const good = await post("/api/auth/login", { email: EMAIL, password: PASSWORD });
  cookieC = jar.refresh;
  check("email login succeeds", good.status === 200 && Boolean(good.data.data?.accessToken));
  check("standard cookie lives ~7 days", (() => {
    const age = maxAgeOf(good.setCookie);
    return age !== null && age > 5 * 86400 && age <= 8 * 86400;
  })(), String(maxAgeOf(good.setCookie)));

  const byPhone = await post("/api/auth/login", {
    email: PHONE, password: PASSWORD, rememberMe: true,
  });
  accessD = byPhone.data.data?.accessToken;
  cookieD = jar.refresh;
  check("phone login succeeds", byPhone.status === 200 && Boolean(accessD));
  check("Remember-Me cookie lives ~30 days", (() => {
    const age = maxAgeOf(byPhone.setCookie);
    return age !== null && age >= 25 * 86400;
  })(), String(maxAgeOf(byPhone.setCookie)));
}

/* ------------------------------------------------------------------ */
console.log("\n=== 7. CSRF double-submit on cookie endpoints ===");
/* ------------------------------------------------------------------ */
{
  const noHeader = await request("POST", "/api/auth/refresh-token", {
    cookie: cookieC, csrf: false,
  });
  check("refresh WITHOUT csrf header → 403", noHeader.status === 403);

  const withHeader = await post("/api/auth/refresh-token", undefined, { cookie: cookieC });
  check("refresh with header succeeds", withHeader.status === 200);
  cookieC = jar.refresh; // rotated again
}

/* ------------------------------------------------------------------ */
console.log("\n=== 8. Device/session management ===");
/* ------------------------------------------------------------------ */
{
  // Present THIS device's own cookie so the API can flag it as current.
  const list = await get("/api/auth/sessions", accessD, { cookie: cookieD });
  const sessions = list.data.data?.sessions || [];
  check("sessions list shows both devices",
    list.status === 200 && sessions.length >= 2, JSON.stringify(sessions).slice(0, 120));
  check("current device flagged", sessions.filter((s) => s.current).length === 1);

  const other = sessions.find((s) => !s.current);
  const killed = await del(`/api/auth/sessions/${other.id}`, accessD);
  check("revoke other device", killed.status === 200);

  const denied = await post("/api/auth/refresh-token", undefined, { cookie: cookieC });
  check("revoked device's refresh denied", denied.status === 401);

  const after = await get("/api/auth/sessions", accessD);
  const remaining = (after.data.data?.sessions || []).length;
  check("list shrinks after revoke", remaining === sessions.length - 1,
    `before=${sessions.length} after=${remaining} status=${after.status}`);
}

/* ------------------------------------------------------------------ */
console.log("\n=== 9. Two-factor login (email OTP) ===");
/* ------------------------------------------------------------------ */
{
  const on = await patchJson("/api/auth/2fa", { enabled: true }, accessD);
  check("enable 2FA", on.status === 200 && on.data.data?.user?.twoFactorEnabled === true);

  const pwOk = await post("/api/auth/login", {
    email: EMAIL, password: PASSWORD, rememberMe: true,
  });
  const pendingToken = pwOk.data.data?.pendingToken;
  devOtp = pwOk.data.devOtp; // SMTP off in tests
  check("password step returns twoFactorRequired",
    pwOk.status === 200 && pwOk.data.data?.twoFactorRequired === true && Boolean(pendingToken));
  // The pending response must NOT mint a session (no refresh cookie).
  check("no session cookie during pending 2FA", !/refreshToken=/.test(pwOk.setCookie || ""));
  check("2FA code issued (devOtp)", /^\d{6}$/.test(devOtp || ""));

  const bad = await post("/api/auth/verify-login-otp", { pendingToken, otp: "000000" });
  check("wrong 2FA code rejected", bad.status === 400);

  const ok2 = await post("/api/auth/verify-login-otp", {
    pendingToken, otp: devOtp, rememberMe: true,
  });
  check("correct 2FA code logs in", ok2.status === 200 && Boolean(ok2.data.data?.accessToken),
    JSON.stringify(ok2.data).slice(0, 140));
  const cookieE = jar.refresh; // session created by the 2FA login

  const off = await patchJson("/api/auth/2fa", { enabled: false }, ok2.data.data?.accessToken);
  check("disable 2FA again", off.status === 200 && off.data.data?.user?.twoFactorEnabled === false);
  globalThis.__cookieE = cookieE;
}

/* ------------------------------------------------------------------ */
console.log("\n=== 10. Forgot / reset password ===");
/* ------------------------------------------------------------------ */
{
  const forgot = await post("/api/auth/forgot-password", { email: EMAIL });
  devOtp = forgot.data.devOtp; // SMTP off in tests
  check("forgot-password answers generically", forgot.status === 200 &&
    /reset code/i.test(forgot.data.message || ""));
  check("reset code issued (devOtp)", /^\d{6}$/.test(devOtp || ""));

  const ghost = await post("/api/auth/forgot-password", {
    email: `ghost.${Date.now()}@example.com`,
  });
  check("unknown email gets SAME generic answer",
    ghost.status === 200 && ghost.data.message === forgot.data.message);

  const reset = await post("/api/auth/reset-password", {
    email: EMAIL, otp: devOtp, newPassword: NEW_PASSWORD,
  });
  check("reset-password succeeds", reset.status === 200, JSON.stringify(reset.data));

  // Every pre-reset session must be dead now — try the 2FA session cookie.
  const staleRefresh = await post("/api/auth/refresh-token", undefined,
    { cookie: globalThis.__cookieE });
  check("all refresh tokens invalidated after reset", staleRefresh.status === 401);

  const oldPw = await post("/api/auth/login", { email: EMAIL, password: PASSWORD });
  check("old password no longer works", oldPw.status === 401);

  const newPw = await post("/api/auth/login", { email: EMAIL, password: NEW_PASSWORD });
  check("login with new password works", newPw.status === 200 &&
    Boolean(newPw.data.data?.accessToken));
}

/* ------------------------------------------------------------------ */
console.log("\n=== 11. Logout blacklisting + lockout (final gates) ===");
/* ------------------------------------------------------------------ */
{
  // Fresh login (post-reset password) for the logout test.
  const fresh = await post("/api/auth/login", { email: EMAIL, password: NEW_PASSWORD });
  const cookieF = jar.refresh;
  check("fresh session for logout test", fresh.status === 200 && Boolean(cookieF));

  const out = await post("/api/auth/logout", undefined, { cookie: cookieF });
  check("logout succeeds", out.status === 200);

  // Replay the exact logged-out token — DENIED even though JWT is valid.
  const replay = await post("/api/auth/refresh-token", undefined, { cookie: cookieF });
  check("logged-out token is blacklisted → 401", replay.status === 401);
  check("blacklist message says session ended",
    /session has ended|log in again/i.test(replay.data.message || ""),
    replay.data.message);
}

{
  let lastStatus = 0;
  for (let i = 0; i < 6; i++) {
    const r = await post("/api/auth/login", { email: EMAIL, password: "WrongPass!99" });
    lastStatus = r.status;
    if (r.status === 423) break;
  }
  check("account locks at threshold (423)", lastStatus === 423);

  const blockedGood = await post("/api/auth/login", { email: EMAIL, password: NEW_PASSWORD });
  check("even CORRECT password blocked while locked", blockedGood.status === 423);

  const byPhoneLocked = await post("/api/auth/login", {
    email: PHONE, password: NEW_PASSWORD,
  });
  check("phone login also blocked while locked", byPhoneLocked.status === 423);
}

console.log(`\n=========================================`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
