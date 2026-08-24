/**
 * OTP (One-Time Password) helpers for email verification.
 *
 * Security properties:
 *  - Codes are generated with a CSPRNG (crypto.randomInt), not Math.random.
 *  - Only the SHA-256 hash of the code is persisted; the raw code lives in
 *    the email itself and nowhere on disk.
 *  - Verification attempts are capped by the Otp model (brute-force guard:
 *    a 6-digit code has 10^6 possibilities; 5 tries ≈ 0.0005% success).
 */
import crypto from "crypto";

/** Generate a cryptographically random 6-digit numeric OTP as a string. */
export function generateOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** SHA-256 fingerprint of an OTP code — this is what gets stored. */
export function hashOtpCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}
