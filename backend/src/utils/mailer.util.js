/**
 * Mail delivery via nodemailer.
 *
 * If SMTP credentials are configured, OTP emails are sent for real.
 * Otherwise (local development) the email content is printed to the
 * console and `smtpConfigured` stays false, which tells controllers it is
 * safe to return the OTP in the API response so devs can finish the flow
 * without an inbox. The dev shortcut is disabled in production.
 */
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter =
  env.smtp.host && env.smtp.user
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465, // true for implicit TLS (port 465)
        auth: { user: env.smtp.user, pass: env.smtp.pass },
      })
    : null;

/** Whether real SMTP delivery is available. */
export function smtpConfigured() {
  return transporter !== null;
}

/**
 * Send a verification-code email.
 * @returns {Promise<{delivered: boolean}>}
 */
export async function sendOtpEmail(to, code, purposeLabel = "verify your email") {
  const subject = "Your Todo App verification code";
  const text = [
    `Your verification code is: ${code}`,
    ``,
    `This code expires in ${env.otp.expiryMinutes} minutes.`,
    `If you didn't request this, you can safely ignore this email.`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:12px;border:1px solid #e2e8f0">
      <h2 style="color:#4f46e5;margin-top:0">Secure Todo App</h2>
      <p>Use the code below to ${purposeLabel}:</p>
      <div style="font-size:32px;letter-spacing:10px;font-weight:700;color:#4f46e5;text-align:center;padding:16px;background:#eef2ff;border-radius:8px">${code}</div>
      <p style="color:#64748b;font-size:14px">This code expires in ${env.otp.expiryMinutes} minutes.
      If you didn't request this, you can safely ignore this email.</p>
    </div>`;

  if (!transporter) {
    console.log(`[mail:dev] SMTP not configured — OTP for ${to}: ${code}`);
    return { delivered: false };
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
    html,
  });
  return { delivered: true };
}
