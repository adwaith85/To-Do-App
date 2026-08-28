/**
 * Google reCAPTCHA v3 server-side verification.
 *
 * reCAPTCHA v3 is invisible: the frontend gets a token from
 * grecaptcha.execute() and submits it with the form; we verify it here
 * against Google's siteverify endpoint and check the confidence score.
 *
 * Optional by design: when RECAPTCHA_SECRET_KEY is not configured the
 * check is skipped entirely (local development without keys).
 */
import crypto from "crypto";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** Is captcha enforcement active on this deployment?
 * reCAPTCHA v3 needs reliable outbound HTTPS to Google's siteverify API,
 * which local dev machines often can't reach — so it is only enforced in
 * production. */
export function captchaEnabled() {
  if (!env.isProd) return false;
  return Boolean(env.recaptcha.secretKey);
}

/**
 * Verify a client token. Throws 400 on failure/low score.
 * @param {string|undefined} token - grecaptcha.getResponse() value.
 * @param {string} expectedAction  - action name used on the client, e.g. "login".
 */
export async function assertCaptcha(token, expectedAction) {
  if (!captchaEnabled()) return; // dev mode: enforcement disabled

  if (!token) {
    throw ApiError.badRequest("Captcha verification failed. Please retry.");
  }

  let result;
  try {
    const params = new URLSearchParams({
      secret: env.recaptcha.secretKey,
      response: token,
    });

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body: params,
      signal: AbortSignal.timeout(5000),
    });
    result = await response.json().catch(() => ({}));
  } catch (error) {
    // Google unreachable (offline/proxy/firewall) — fail open so genuine
    // users aren't blocked by a captcha outage. Log for visibility.
    console.warn("[captcha] siteverify request failed — skipping check:", error.message);
    return;
  }

  const actionOk = !expectedAction || result.action === expectedAction;
  // Some responses omit "score" (v2-style); treat missing score as neutral.
  const scoreOk =
    typeof result.score !== "number" || result.score >= env.recaptcha.minScore;
  const passed = result.success === true && actionOk && scoreOk;

  if (!passed) {
    throw ApiError.badRequest("Captcha verification failed. Please retry.");
  }
}

/* ------------------------------------------------------------------ */
/* Visual captcha (self-hosted, no Google dependency)                  */
/*                                                                     */
/* Used by the login screen so every sign-in proves a human solves a   */
/* simple image code. Stateless & HMAC-signed — nothing stored in DB:  */
/*  token = base64url({ exp, nonce, sig = HMAC(code, exp, nonce) })    */
/* On submit the server recomputes the HMAC over the typed code; a     */
/* match proves the typed code equals the one that issued the token.   */
/* ------------------------------------------------------------------ */

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const CODE_LENGTH = 5;
// No 0/O/1/I — avoids read-back confusion.
const CODE_ALPHABET = "ACDEFGHJKLMNPRTUVWXY34679";
// Black-on-white, like classic captchas — ink greys only, no colour fill.
const CHAR_COLORS = ["#111827", "#1f2937", "#374151"];

function randInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function pick(list) {
  return list[randInt(0, list.length - 1)];
}

function captchaHmac(code, exp, nonce) {
  return crypto
    .createHmac("sha256", env.jwt.refreshSecret)
    .update(`${code}|${exp}|${nonce}`)
    .digest("base64url")
    .slice(0, 32);
}

/** Issue a fresh captcha: returns { svg, token, expiresIn } (NOT the code). */
export function createCaptcha() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randInt(0, CODE_ALPHABET.length - 1)];

  const exp = Date.now() + CAPTCHA_TTL_MS;
  const nonce = crypto.randomBytes(8).toString("hex");
  const token = Buffer.from(
    JSON.stringify({ exp, nonce, sig: captchaHmac(code, exp, nonce) })
  ).toString("base64url");

  return { svg: renderCaptchaSvg(code), token, expiresIn: Math.floor(CAPTCHA_TTL_MS / 1000) };
}

/**
 * Check a user's typed code against an issued token.
 * Case-insensitive; single attempt, no brute-force vector beyond a guess.
 */
export function verifyCaptcha(token, text) {
  try {
    const { exp, nonce, sig } = JSON.parse(
      Buffer.from(String(token || ""), "base64url").toString("utf8")
    );
    if (typeof exp !== "number" || typeof nonce !== "string" || typeof sig !== "string") return false;
    if (!Number.isFinite(exp) || Date.now() > exp) return false;

    const expected = captchaHmac(String(text || "").trim().toUpperCase(), exp, nonce);
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Render the code as a small distorted SVG image (no external assets). */
function renderCaptchaSvg(code) {
  const W = 140;
  const H = 50;

  const chars = [...code]
    .map((ch, i) => {
      const x = 16 + i * 24 + randInt(-3, 3);
      const y = 31 + randInt(-7, 7);
      const rot = randInt(-26, 26);
      const size = 21 + randInt(-4, 4);
      return `<text x="${x}" y="${y}" fill="${pick(CHAR_COLORS)}" font-family="DejaVu Sans, Verdana, monospace" font-weight="bold" font-size="${size}" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;
    })
    .join("");

  const noise = Array.from({ length: 5 }, () => {
    const x1 = randInt(0, W); const y1 = randInt(0, H);
    const x2 = randInt(0, W); const y2 = randInt(0, H);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${pick(["#d1d5db99", "#9ca3af66", "#e5e7ebaa"])}" stroke-width="1.2"/>`;
  }).join("");

  const dots = Array.from({ length: 22 }, () => {
    const cx = randInt(0, W); const cy = randInt(0, H); const r = randInt(1, 2);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#d1d5db"/>`;
  }).join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="captcha">` +
    `<rect width="100%" height="100%" rx="12" fill="#ffffff"/>` +
    `<rect width="100%" height="100%" rx="12" fill="url(#cg)"/>` +
    `<defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#f3f4f6" stop-opacity="0.9"/>` +
    `<stop offset="1" stop-color="#e5e7eb" stop-opacity="0.55"/>` +
    `</linearGradient></defs>` +
    `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="9" fill="none" stroke="#e5e7eb"/>` +
    noise + dots + chars +
    `</svg>`
  );
}
