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
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** Is captcha enforcement active on this deployment? */
export function captchaEnabled() {
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

  const params = new URLSearchParams({
    secret: env.recaptcha.secretKey,
    response: token,
  });

  const response = await fetch(VERIFY_URL, { method: "POST", body: params });
  const result = await response.json().catch(() => ({}));

  const actionOk = !expectedAction || result.action === expectedAction;
  // Some responses omit "score" (v2-style); treat missing score as neutral.
  const scoreOk =
    typeof result.score !== "number" || result.score >= env.recaptcha.minScore;
  const passed = result.success === true && actionOk && scoreOk;

  if (!passed) {
    throw ApiError.badRequest("Captcha verification failed. Please retry.");
  }
}
