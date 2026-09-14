/**
 * OTP service — issuing and verifying hashed email one-time codes.
 *
 * Flow: register → code emailed → POST /verify-otp (account activated).
 * Codes are SHA-256 hashed at rest, expire in ~10 minutes, cap failed
 * attempts, and enforce a resend cooldown to prevent mail bombing.
 */
import Otp, { OTP_TYPES } from "../models/otp.model.js";
import { generateOtpCode, hashOtpCode } from "../utils/otp.util.js";
import { sendOtpEmail } from "../utils/mailer.util.js";
import { ApiError } from "../utils/ApiError.js";

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || "60", 10);
const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

/**
 * Create (or replace) the active OTP for an email, then deliver it.
 *
 * @param {"email"|"phone"|"password_reset"|"login_2fa"} type - purpose.
 * @param {string} target                - the email address / phone number.
 * @param {string|null} [userId]         - owning account, when known.
 * @returns {Promise<{delivered: boolean, devCode?: string}>}
 *   devCode is present ONLY when SMTP isn't configured outside production
 *   (lets devs complete flows without an inbox).
 */
export async function issueOtp(type, target, userId = null) {
  const code = generateOtpCode();

  await Otp.findOneAndUpdate(
    { target, type },
    {
      $set: {
        userId,
        codeHash: hashOtpCode(code),
        attempts: 0,      // fresh code → fresh attempt budget
        used: false,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const { delivered } = await sendOtpEmail(target, code);

  // Dev fallback: expose the code only when no real provider exists.
  const devAllowed = !isProd && !isTest;
  return delivered ? { delivered } : devAllowed ? { delivered, devCode: code } : { delivered };
}

/**
 * Enforce the cooldown between resend requests (mail-bombing guard).
 * Throws 429 if a code for this target+type was issued too recently.
 */
export async function assertResendCooldown(target, type) {
  const existing = await Otp.findOne({ target, type });
  if (!existing) return;

  const elapsedSeconds = (Date.now() - existing.updatedAt.getTime()) / 1000;
  if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
    const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
    throw ApiError.tooManyRequests(`Please wait ${wait}s before requesting another code.`);
  }
}

/**
 * Validate a submitted code against the stored hash.
 *
 * Failure modes all become 400/429 with identical wording so an attacker
 * can't distinguish "wrong" from "expired":
 *   - no code issued / already used / expired
 *   - too many attempts (locked)
 *   - mismatch (attempts++)
 *
 * On success the document is marked used=true so it can't be replayed.
 */
export async function verifyOtpForTarget(type, target, code) {
  const otpDoc = await Otp.findOne({ target, type });

  if (!otpDoc || otpDoc.used || otpDoc.isExpired()) {
    throw ApiError.badRequest("Invalid or expired verification code.");
  }

  if (otpDoc.isLocked()) {
    throw ApiError.tooManyRequests("Too many incorrect attempts. Request a new code.");
  }

  if (otpDoc.codeHash !== hashOtpCode(code)) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - otpDoc.attempts);
    throw ApiError.badRequest(
      remaining > 0
        ? `Incorrect verification code. ${remaining} attempt(s) left.`
        : "Too many incorrect attempts. Request a new code."
    );
  }

  otpDoc.used = true;
  await otpDoc.save();
}
