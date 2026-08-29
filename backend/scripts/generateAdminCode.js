#!/usr/bin/env node
/**
 * One-time internal admin-code generator.
 *
 * Promotes a user to role "admin" (if not already) and stores a hashed
 * Admin Code on their account. Prints the PLAIN code to your terminal
 * exactly once — it is NEVER stored in plaintext anywhere.
 *
 * Usage (from backend/):
 *   node scripts/generateAdminCode.js <userId>       # auto-generate a code
 *   node scripts/generateAdminCode.js <userId> 123456   # provide your own
 *
 * A custom code may be a 6-digit number or an ADM-XXXX-XXXX token. Give the
 * printed code to the admin separately; treat it like a password.
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";
import { connectDB, disconnectDB } from "../src/config/db.js";
import User from "../src/models/user.model.js";

dotenv.config();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomChars(len) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return out;
}

function makeCode(prefix = "ADM") {
  // e.g. ADM-7F3K9QX2 (2 groups of 4). Mac-like so it's easy to read aloud.
  return `${prefix}-${randomChars(4)}-${randomChars(4)}`;
}

async function main() {
  const [rawUserId, customCode] = process.argv.slice(2);

  if (!rawUserId) {
    console.error(
      "Usage: node scripts/generateAdminCode.js <userId> [123456|ADM-XXXX-XXXX]"
    );
    process.exit(1);
  }
  if (!/^[0-9a-fA-F]{24}$/.test(rawUserId)) {
    console.error("Invalid userId (expected a 24-char Mongo ObjectId).");
    process.exit(1);
  }

  let code = customCode;
  if (code && !/^(\d{6}|[A-Z0-9]{3,4}-[A-Z0-9]{4,}-[A-Z0-9]{4,})$/.test(code)) {
    console.error("Provided code must be a 6-digit number or match ADM-XXXX-XXXX format.");
    process.exit(1);
  }
  if (!code) code = makeCode();

  await connectDB();

  const user = await User.findById(rawUserId);
  if (!user) {
    console.error("User not found.");
    await disconnectDB();
    process.exit(1);
  }

  // Hash with bcrypt (matches the User.compareAdminCode method which uses bcrypt).
  const hash = await bcrypt.hash(code, 12);

  user.role = "admin";
  user.adminCode = hash;
  user.adminCodeSetAt = new Date();
  await user.save();

  console.log("\n──────────────────────────────────────────────");
  console.log("  Pormoted to admin:", user.name, `<${user.email}>`);
  console.log("  Admin Code      :", code);
  console.log("");
  console.log("  > Store this code SAFELY. It is shown only once.");
  console.log("  > Give it to the admin; they type it into the");
  console.log("    login page's verification field to sign in as admin.");
  console.log("──────────────────────────────────────────────\n");

  await disconnectDB();
}

main().catch((err) => {
  console.error("Generator failed:", err);
  process.exit(1);
});
