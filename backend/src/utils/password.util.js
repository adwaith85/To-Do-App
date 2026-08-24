/**
 * Password hashing helpers (bcrypt).
 *
 * bcrypt is deliberately slow + salted per-hash, which makes offline
 * cracking expensive. Cost factor 12 ≈ ~250ms/hash on modern hardware —
 * a good balance between security and login latency.
 */
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/** Hash a plaintext password. Never log or store the plaintext. */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Constant-time comparison of a candidate against the stored hash. */
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
