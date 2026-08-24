/**
 * API smoke test — exercises the whole auth + todos flow with plain fetch.
 *
 * Run:  node scripts/smoke-test.mjs   (server must be running on $BASE)
 * The server should be started WITHOUT reCAPTCHA and WITH SMTP disabled so
 * devOtp codes are returned and captcha checks are skipped.
 */
const BASE = process.env.BASE || "http://localhost:8090";

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

/** Minimal JSON POST helper. */
async function post(path, body, cookie) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie && { Cookie: cookie }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, data, setCookie };
}

async function get(path, token) {
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function patch(path, token) {
  const res = await fetch(BASE + path, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function del(path, token) {
  const res = await fetch(BASE + path, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

/* Extract just the refreshToken=... part of a Set-Cookie header. */
function refreshCookieFrom(setCookieHeader) {
  const match = /refreshToken=[^;]+/.exec(setCookieHeader || "");
  return match ? match[0] : null;
}

console.log("\n=== 1. Validation & registration ===");

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
}

{
  const r = await post("/api/auth/register", {
    name: "Smoke Test", email: EMAIL, phone: PHONE, password: PASSWORD,
  });
  check("duplicate register → 409", r.status === 409);
}

console.log("\n=== 2. OTP verification ===");
{
  const r = await post("/api/auth/verify-otp", { email: EMAIL, otp: "000000" });
  check("wrong OTP rejected", r.status === 400);

  const ok = await post("/api/auth/verify-otp", { email: EMAIL, otp: devOtp });
  accessA = ok.data.data?.accessToken;
  cookieA = refreshCookieFrom(ok.setCookie);
  check("correct OTP verifies & logs in", ok.status === 200 && Boolean(accessA), JSON.stringify(ok.data));
  check("refresh cookie set", Boolean(cookieA));

  const reused = await post("/api/auth/verify-otp", { email: EMAIL, otp: devOtp });
  check("OTP cannot be replayed", reused.status === 400 || reused.data.data?.alreadyVerified === true);
}

console.log("\n=== 3. Protected routes ===");
{
  const anon = await get("/api/todos");
  check("todos without token → 401", anon.status === 401);

  const me = await get("/api/auth/me", accessA);
  check("GET /me returns profile", me.status === 200 && me.data.data?.user?.email === EMAIL);
  check("profile hides sensitive fields",
    !("password" in (me.data.data?.user || {})) &&
    !("refreshTokens" in (me.data.data?.user || {})));
}

console.log("\n=== 4. Todos CRUD ===");
let todoId = null;
{
  const created = await fetch(BASE + "/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessA}` },
    body: JSON.stringify({ task: "Write smoke test" }),
  });
  const cd = await created.json();
  todoId = cd.data?._id;
  check("create todo", created.status === 201 && Boolean(todoId));

  const list = await get("/api/todos", accessA);
  check("list todos contains new item", list.status === 200 &&
    Array.isArray(list.data.data) && list.data.data.some((t) => t._id === todoId));

  const badId = await patch(`/api/todos/${"0".repeat(24)}`, accessA);
  check("toggle unknown id → 404", badId.status === 404);

  const toggled = await patch(`/api/todos/${todoId}`, accessA);
  check("toggle flips status", toggled.status === 200 && toggled.data.data?.status === "completed");

  const removed = await del(`/api/todos/${todoId}`, accessA);
  check("delete todo", removed.status === 200);
}

console.log("\n=== 5. Refresh rotation ===");
let cookieB = null;
{
  const r1 = await post("/api/auth/refresh-token", null, cookieA);
  accessA = r1.data.data?.accessToken || accessA;
  cookieB = refreshCookieFrom(r1.setCookie);
  check("rotation issues new pair", r1.status === 200 && Boolean(cookieB) && cookieB !== cookieA);

  // Replaying the OLD (rotated-away) cookie must trigger theft detection.
  const replay = await post("/api/auth/refresh-token", null, cookieA);
  check("replayed rotated token revoked ALL sessions", replay.status === 401);

  // The NEWEST cookie is dead now too (all sessions were revoked).
  const newest = await post("/api/auth/refresh-token", null, cookieB);
  check("post-revoke refresh denied", newest.status === 401);
}

console.log("\n=== 6. Login + lockout ===");
{
  const wrong = await post("/api/auth/login", { email: EMAIL, password: "WrongPass!99" });
  check("wrong password → 401", wrong.status === 401);

  const nover = await post("/api/auth/login", {
    email: `unverified.${Date.now()}@example.com`, password: PASSWORD,
  });
  check("unknown email → same 401 wording", nover.status === 401 &&
    nover.data.message === wrong.data.message);

  const good = await post("/api/auth/login", { email: EMAIL, password: PASSWORD });
  check("correct login succeeds", good.status === 200 && Boolean(good.data.data?.accessToken));
  cookieA = refreshCookieFrom(good.setCookie);
}

console.log("\n=== 7. Logout blacklisting (the key requirement) ===");
{
  const out = await post("/api/auth/logout", null, cookieA);
  check("logout succeeds", out.status === 200);

  // Replay the exact logged-out token — must be DENIED even though JWT is valid.
  const replay = await post("/api/auth/refresh-token", null, cookieA);
  check("logged-out token is blacklisted → 401", replay.status === 401);
  check("blacklist message says session ended",
    /session has ended|log in again/i.test(replay.data.message || ""),
    replay.data.message);

  // Access token from before logout still works until expiry (stateless),
  // but refresh can never mint a new one.
}

console.log("\n=== 8. Account lockout after 5 failures ===");
{
  let lastStatus = 0;
  for (let i = 0; i < 6; i++) {
    const r = await post("/api/auth/login", { email: EMAIL, password: "WrongPass!99" });
    lastStatus = r.status;
    if (r.status === 423) break;
  }
  check("account locks at threshold (423)", lastStatus === 423);

  const blockedGood = await post("/api/auth/login", { email: EMAIL, password: PASSWORD });
  check("even CORRECT password blocked while locked", blockedGood.status === 423);
}

console.log(`\n=========================================`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
