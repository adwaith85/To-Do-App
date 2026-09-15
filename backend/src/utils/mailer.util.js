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

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || "Secure Todo <no-reply@todoapp.local>";
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10);

const transporter =
  SMTP_HOST && SMTP_USER
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // true for implicit TLS (port 465)
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

/** Whether real SMTP delivery is available. */
export function smtpConfigured() {
  return transporter !== null;
}

/* ─────────────────────────────────────────────────────────────────
   SHARED EMAIL LAYOUT HELPERS
   All emails use the same dark-purple brand shell.
   ───────────────────────────────────────────────────────────────── */

/**
 * Wraps a content block in the standard branded email shell.
 * @param {object} opts
 * @param {string} opts.preheader  - short preview text shown in inbox list
 * @param {string} opts.body       - inner HTML (goes inside the card)
 * @param {string} [opts.footerNote] - optional extra footer line
 */
function emailShell({ preheader, body, footerNote = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>SecureTodo</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#12091f;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- preheader (hidden preview) -->
  <div style="display:none;max-height:0;overflow:hidden;color:#12091f;">
    ${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:#12091f;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">

      <!-- card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:520px;">
        <tr><td style="
          background:linear-gradient(145deg,#1e1035 0%,#2a1550 60%,#1a0d3a 100%);
          border-radius:20px;
          border:1px solid rgba(139,92,246,0.22);
          box-shadow:0 24px 60px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.06);
          overflow:hidden;
          padding:0;
        ">

          <!-- logo strip -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="
              padding:24px 32px 20px;
              border-bottom:1px solid rgba(139,92,246,0.15);
            ">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="
                    background:linear-gradient(135deg,#7c3aed,#a855f7);
                    border-radius:10px;
                    padding:7px 14px;
                    font-size:13px;
                    font-weight:800;
                    color:#fff;
                    letter-spacing:0.5px;
                  ">✓ SecureTodo</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- body content -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:32px 32px 28px;">
              ${body}
            </td></tr>
          </table>

          <!-- footer -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="
              padding:18px 32px 24px;
              border-top:1px solid rgba(139,92,246,0.12);
              text-align:center;
            ">
              <p style="margin:0 0 4px;font-size:11px;color:#6b5a8e;">
                This email was sent by SecureTodo · No-reply address
              </p>
              ${footerNote
                ? `<p style="margin:0;font-size:11px;color:#6b5a8e;">${footerNote}</p>`
                : ""}
            </td></tr>
          </table>

        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/** Reusable "info row" for tables inside emails (When / IP / Device). */
function infoRow(label, value) {
  return `
    <tr>
      <td style="padding:7px 12px 7px 0;font-size:12px;color:#9d8fc1;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:7px 0;font-size:13px;color:#c4b5fd;word-break:break-all;">${value}</td>
    </tr>`;
}

/* ─────────────────────────────────────────────────────────────────
   1. OTP / VERIFICATION CODE EMAIL
   ───────────────────────────────────────────────────────────────── */

/**
 * Send a 6-digit code email for any flow (verify, 2FA, password reset).
 * @param {string} to
 * @param {string} code
 * @param {string} [purposeLabel] - human phrasing embedded in the body.
 * @returns {Promise<{delivered: boolean}>}
 */
export async function sendOtpEmail(to, code, purposeLabel = "verify your email") {
  // Derive a context-aware heading from the purpose label
  const isReset   = purposeLabel.toLowerCase().includes("reset");
  const is2FA     = purposeLabel.toLowerCase().includes("sign-in") || purposeLabel.toLowerCase().includes("2fa") || purposeLabel.toLowerCase().includes("login");
  const heading   = isReset ? "Password Reset" : is2FA ? "Two-Factor Sign-In" : "Email Verification";
  const iconColor = isReset ? "#f59e0b" : is2FA ? "#06b6d4" : "#8b5cf6";
  const icon      = isReset ? "🔑" : is2FA ? "🛡️" : "✉️";

  const subject = isReset
    ? "Your SecureTodo password reset code"
    : is2FA
    ? "SecureTodo two-factor sign-in code"
    : "Verify your SecureTodo account";

  const text = [
    `${heading}`,
    ``,
    `Your one-time code: ${code}`,
    ``,
    `Use this code to ${purposeLabel}.`,
    `It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    ``,
    `If you did not request this, please ignore this email or contact support.`,
  ].join("\n");

  const body = `
    <!-- heading -->
    <p style="margin:0 0 6px;font-size:13px;color:#9d8fc1;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
      ${icon} &nbsp;${heading}
    </p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ede9fe;line-height:1.3;">
      Use this code to ${purposeLabel}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#b8a9d9;line-height:1.7;">
      Enter the verification code below to continue. It is valid for
      <strong style="color:#c4b5fd;">${OTP_EXPIRY_MINUTES} minutes</strong> and can only be used once.
    </p>

    <!-- OTP block -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td style="
        background:rgba(139,92,246,0.12);
        border:1.5px solid rgba(139,92,246,0.35);
        border-radius:14px;
        padding:28px 20px;
        text-align:center;
      ">
        <p style="margin:0 0 8px;font-size:11px;color:#9d8fc1;letter-spacing:1.5px;text-transform:uppercase;">
          One-Time Code
        </p>
        <p style="
          margin:0;
          font-size:44px;
          font-weight:800;
          letter-spacing:14px;
          color:${iconColor};
          font-family:'Courier New',Courier,monospace;
          line-height:1.1;
        ">${code}</p>
      </td></tr>
    </table>

    <!-- expiry note -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="
          background:rgba(245,158,11,0.08);
          border-left:3px solid #f59e0b;
          border-radius:0 8px 8px 0;
          padding:10px 14px;
          font-size:12px;
          color:#d4b483;
          line-height:1.5;
        ">
          ⏱ This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
          Do not share it with anyone — SecureTodo will never ask for your code.
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#7c6d9e;line-height:1.6;">
      Didn't request this? You can safely ignore this email. No changes were made to your account.
    </p>
  `;

  const html = emailShell({
    preheader: `Your SecureTodo verification code is ${code} — expires in ${OTP_EXPIRY_MINUTES} minutes`,
    body,
    footerNote: "Never share this code with anyone, including SecureTodo support.",
  });

  if (!transporter) {
    console.log(`[mail:dev] SMTP not configured — OTP for ${to}: ${code}`);
    return { delivered: false };
  }

  await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
  return { delivered: true };
}

/* ─────────────────────────────────────────────────────────────────
   2. NEW DEVICE / SECURITY ALERT EMAIL
   ───────────────────────────────────────────────────────────────── */

/**
 * Security alert: a login from a device/IP this account has never used.
 * Fire-and-forget friendly — callers may await it but failures only log.
 * @returns {Promise<{delivered: boolean}>}
 */
export async function sendNewLoginAlert(to, { ip, device, when }) {
  if (!transporter) {
    console.log(`[mail:dev] New-device alert for ${to} (ip=${ip}) — SMTP not configured`);
    return { delivered: false };
  }

  const shortDevice = String(device || "unknown device").slice(0, 120);
  const subject = "⚠️ New sign-in to your SecureTodo account";

  const text = [
    `New device sign-in detected`,
    ``,
    `We noticed a sign-in from a device you haven't used before.`,
    ``,
    `When  : ${when}`,
    `Where : IP ${ip}`,
    `Device: ${shortDevice}`,
    ``,
    `If this was you, no action is needed.`,
    `If NOT, reset your password immediately and sign out of all devices.`,
  ].join("\n");

  const body = `
    <!-- alert badge -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr><td style="
        background:rgba(239,68,68,0.15);
        border:1px solid rgba(239,68,68,0.35);
        border-radius:8px;
        padding:6px 14px;
        font-size:12px;
        font-weight:700;
        color:#fca5a5;
        letter-spacing:0.5px;
      ">⚠️ &nbsp;SECURITY ALERT</td></tr>
    </table>

    <h1 style="margin:0 0 12px;font-size:21px;font-weight:700;color:#ede9fe;line-height:1.3;">
      New sign-in from an unrecognised device
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#b8a9d9;line-height:1.7;">
      Your account was just accessed from a device we haven't seen before.
      Review the details below and take action if this wasn't you.
    </p>

    <!-- detail table -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="
      background:rgba(239,68,68,0.07);
      border:1px solid rgba(239,68,68,0.2);
      border-radius:12px;
      padding:16px 20px;
      margin:0 0 24px;
    ">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${infoRow("When", when)}
          ${infoRow("IP Address", ip)}
          ${infoRow("Device", shortDevice)}
        </table>
      </td></tr>
    </table>

    <!-- if-you action note -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
      <tr>
        <td style="
          background:rgba(16,185,129,0.08);
          border-left:3px solid #10b981;
          border-radius:0 8px 8px 0;
          padding:10px 14px;
          font-size:13px;
          color:#6ee7b7;
          line-height:1.5;
        ">
          ✅ &nbsp;<strong>If this was you</strong> — no action needed. Your account is safe.
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="
          background:rgba(239,68,68,0.09);
          border-left:3px solid #ef4444;
          border-radius:0 8px 8px 0;
          padding:10px 14px;
          font-size:13px;
          color:#fca5a5;
          line-height:1.5;
        ">
          🚨 &nbsp;<strong>If this wasn't you</strong> — reset your password immediately
          and sign out of all devices from your account settings.
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#7c6d9e;line-height:1.6;">
      This alert was generated automatically. SecureTodo will never ask for your password or OTP codes.
    </p>
  `;

  const html = emailShell({
    preheader: `New sign-in from ${ip} at ${when} — was this you?`,
    body,
    footerNote: "If you did not sign in, reset your password immediately.",
  });

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return { delivered: true };
  } catch (error) {
    console.error("[mail] New-login alert failed:", error.message);
    return { delivered: false };
  }
}

/* ─────────────────────────────────────────────────────────────────
   3. WELCOME EMAIL  (new — sent after registration is complete)
   ───────────────────────────────────────────────────────────────── */

/**
 * Send a welcome email after a user finishes full registration (password set).
 * @param {string} to
 * @param {{ name: string }} opts
 * @returns {Promise<{delivered: boolean}>}
 */
export async function sendWelcomeEmail(to, { name }) {
  if (!transporter) {
    console.log(`[mail:dev] Welcome email for ${to} — SMTP not configured`);
    return { delivered: false };
  }

  const firstName = String(name || "there").split(" ")[0];
  const subject = "Welcome to SecureTodo 🎉";

  const text = [
    `Welcome to SecureTodo, ${firstName}!`,
    ``,
    `Your account is all set. You can now log in and start organising your tasks.`,
    ``,
    `A few things you can do:`,
    `  • Create and manage your todos`,
    `  • Set reminders so you never miss a deadline`,
    `  • Enable two-factor authentication for extra security`,
    ``,
    `Happy tasking!`,
    `— The SecureTodo Team`,
  ].join("\n");

  const body = `
    <!-- greeting -->
    <p style="margin:0 0 6px;font-size:13px;color:#a78bfa;font-weight:600;letter-spacing:0.5px;">
      🎉 &nbsp;WELCOME ABOARD
    </p>
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;color:#ede9fe;line-height:1.3;">
      You're all set, ${firstName}!
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:#b8a9d9;line-height:1.7;">
      Your SecureTodo account is ready. Start organising your tasks, set
      reminders, and stay on top of everything that matters.
    </p>

    <!-- feature highlights -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="
          background:rgba(139,92,246,0.1);
          border:1px solid rgba(139,92,246,0.2);
          border-radius:14px;
          padding:20px 22px;
        ">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:6px 0;">
                <span style="color:#a78bfa;font-size:16px;">📝</span>
                <span style="font-size:13px;color:#c4b5fd;margin-left:10px;font-weight:600;">Create &amp; manage todos</span>
                <br/>
                <span style="font-size:12px;color:#9d8fc1;margin-left:26px;">Add tasks, set priorities, track progress</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-top:1px solid rgba(139,92,246,0.12);">
                <span style="color:#06b6d4;font-size:16px;">⏰</span>
                <span style="font-size:13px;color:#c4b5fd;margin-left:10px;font-weight:600;">Smart reminders</span>
                <br/>
                <span style="font-size:12px;color:#9d8fc1;margin-left:26px;">Get email reminders before deadlines</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-top:1px solid rgba(139,92,246,0.12);">
                <span style="color:#10b981;font-size:16px;">🛡️</span>
                <span style="font-size:13px;color:#c4b5fd;margin-left:10px;font-weight:600;">Two-factor authentication</span>
                <br/>
                <span style="font-size:12px;color:#9d8fc1;margin-left:26px;">Enable 2FA from your profile for extra security</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#7c6d9e;line-height:1.6;">
      Questions? Just reply to this email and our team will get back to you.
      Welcome to the community!
    </p>
  `;

  const html = emailShell({
    preheader: `Welcome to SecureTodo, ${firstName}! Your account is ready.`,
    body,
  });

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return { delivered: true };
  } catch (error) {
    console.error("[mail] Welcome email failed:", error.message);
    return { delivered: false };
  }
}

/* ─────────────────────────────────────────────────────────────────
   4. PASSWORD CHANGED CONFIRMATION EMAIL  (new)
   ───────────────────────────────────────────────────────────────── */

/**
 * Confirmation email after a password reset succeeds.
 * @param {string} to
 * @param {{ name: string, when: string, ip: string }} opts
 * @returns {Promise<{delivered: boolean}>}
 */
export async function sendPasswordChangedEmail(to, { name, when, ip }) {
  if (!transporter) {
    console.log(`[mail:dev] Password-changed email for ${to} — SMTP not configured`);
    return { delivered: false };
  }

  const firstName = String(name || "there").split(" ")[0];
  const subject = "Your SecureTodo password was changed";

  const text = [
    `Hi ${firstName},`,
    ``,
    `Your SecureTodo account password was successfully changed.`,
    ``,
    `When  : ${when}`,
    `IP    : ${ip}`,
    ``,
    `If you made this change, no action is needed.`,
    `If you did NOT change your password, contact us immediately and reset it.`,
  ].join("\n");

  const body = `
    <p style="margin:0 0 6px;font-size:13px;color:#10b981;font-weight:600;letter-spacing:0.5px;">
      🔐 &nbsp;PASSWORD UPDATED
    </p>
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:#ede9fe;line-height:1.3;">
      Your password has been changed, ${firstName}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#b8a9d9;line-height:1.7;">
      Your SecureTodo account password was successfully updated. All previous
      sessions have been signed out for your security.
    </p>

    <!-- detail table -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="
      background:rgba(16,185,129,0.07);
      border:1px solid rgba(16,185,129,0.2);
      border-radius:12px;
      padding:16px 20px;
      margin:0 0 24px;
    ">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${infoRow("Changed at", when)}
          ${infoRow("IP Address", ip)}
        </table>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
      <tr>
        <td style="
          background:rgba(16,185,129,0.08);
          border-left:3px solid #10b981;
          border-radius:0 8px 8px 0;
          padding:10px 14px;
          font-size:13px;
          color:#6ee7b7;
          line-height:1.5;
        ">
          ✅ &nbsp;<strong>This was you?</strong> — Great, your account is secure. Log in with your new password.
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="
          background:rgba(239,68,68,0.09);
          border-left:3px solid #ef4444;
          border-radius:0 8px 8px 0;
          padding:10px 14px;
          font-size:13px;
          color:#fca5a5;
          line-height:1.5;
        ">
          🚨 &nbsp;<strong>Wasn't you?</strong> — Use "Forgot Password" immediately
          to regain access, then contact support.
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#7c6d9e;line-height:1.6;">
      As a precaution, you have been signed out from all active devices.
      You can sign back in using your new password.
    </p>
  `;

  const html = emailShell({
    preheader: `Your SecureTodo password was changed at ${when}. Was this you?`,
    body,
    footerNote: "If you did not make this change, contact support immediately.",
  });

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return { delivered: true };
  } catch (error) {
    console.error("[mail] Password-changed email failed:", error.message);
    return { delivered: false };
  }
}

/* ─────────────────────────────────────────────────────────────────
   5. ACCOUNT STATUS EMAIL  (new — sent for admin-initiated changes)
   ───────────────────────────────────────────────────────────────── */

/**
 * Notify a user when an admin has changed their account status.
 * Only called for user-facing actions: lock, unlock, deactivate, reactivate.
 *
 * @param {string} to
 * @param {{
 *   name: string,
 *   action: "locked"|"unlocked"|"deactivated"|"reactivated",
 *   reason?: string
 * }} opts
 * @returns {Promise<{delivered: boolean}>}
 */
export async function sendAccountStatusEmail(to, { name, action, reason }) {
  if (!transporter) {
    console.log(`[mail:dev] Account-status email (${action}) for ${to} — SMTP not configured`);
    return { delivered: false };
  }

  const firstName = String(name || "there").split(" ")[0];

  const configs = {
    locked: {
      subject: "Your SecureTodo account has been temporarily locked",
      badge: "⚠️ ACCOUNT LOCKED",
      badgeColor: "#f59e0b",
      badgeBg: "rgba(245,158,11,0.15)",
      badgeBorder: "rgba(245,158,11,0.35)",
      heading: `Your account has been temporarily locked, ${firstName}`,
      lead: "Your SecureTodo account has been temporarily restricted by our security team. You will not be able to sign in until it is unlocked.",
      noteColor: "#f59e0b",
      noteBg: "rgba(245,158,11,0.09)",
      noteBorder: "#f59e0b",
      noteText: "If you believe this is a mistake or need help, please contact our support team.",
    },
    unlocked: {
      subject: "Your SecureTodo account has been unlocked",
      badge: "✅ ACCOUNT RESTORED",
      badgeColor: "#10b981",
      badgeBg: "rgba(16,185,129,0.15)",
      badgeBorder: "rgba(16,185,129,0.35)",
      heading: `Your account access has been restored, ${firstName}`,
      lead: "Great news! Your SecureTodo account has been unlocked. You can now sign in and use all features normally.",
      noteColor: "#10b981",
      noteBg: "rgba(16,185,129,0.08)",
      noteBorder: "#10b981",
      noteText: "If you experience any issues signing in, please contact our support team.",
    },
    deactivated: {
      subject: "Your SecureTodo account has been deactivated",
      badge: "🚫 ACCOUNT DEACTIVATED",
      badgeColor: "#ef4444",
      badgeBg: "rgba(239,68,68,0.15)",
      badgeBorder: "rgba(239,68,68,0.35)",
      heading: `Your account has been deactivated, ${firstName}`,
      lead: "Your SecureTodo account has been deactivated. All active sessions have been ended and you will no longer be able to sign in.",
      noteColor: "#ef4444",
      noteBg: "rgba(239,68,68,0.09)",
      noteBorder: "#ef4444",
      noteText: "If you believe this was done in error, please contact our support team to appeal.",
    },
    reactivated: {
      subject: "Your SecureTodo account has been reactivated",
      badge: "✅ ACCOUNT REACTIVATED",
      badgeColor: "#8b5cf6",
      badgeBg: "rgba(139,92,246,0.15)",
      badgeBorder: "rgba(139,92,246,0.35)",
      heading: `Welcome back — your account is active again, ${firstName}`,
      lead: "Your SecureTodo account has been reactivated. You can now sign in and access all your todos and settings.",
      noteColor: "#8b5cf6",
      noteBg: "rgba(139,92,246,0.09)",
      noteBorder: "#8b5cf6",
      noteText: "If you have any questions about your account, our support team is happy to help.",
    },
  };

  const cfg = configs[action];
  if (!cfg) {
    console.warn(`[mail] sendAccountStatusEmail: unknown action "${action}" — skipping`);
    return { delivered: false };
  }

  const text = [
    `Hi ${firstName},`,
    ``,
    `Your SecureTodo account has been ${action}.`,
    reason ? `Reason: ${reason}` : "",
    ``,
    cfg.noteText,
  ].filter(Boolean).join("\n");

  const body = `
    <!-- badge -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr><td style="
        background:${cfg.badgeBg};
        border:1px solid ${cfg.badgeBorder};
        border-radius:8px;
        padding:6px 14px;
        font-size:12px;
        font-weight:700;
        color:${cfg.badgeColor};
        letter-spacing:0.5px;
      ">${cfg.badge}</td></tr>
    </table>

    <h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:#ede9fe;line-height:1.3;">
      ${cfg.heading}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#b8a9d9;line-height:1.7;">
      ${cfg.lead}
    </p>

    ${reason ? `
    <!-- reason block -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.1);
      border-radius:12px;
      padding:14px 18px;
      margin:0 0 20px;
    ">
      <tr><td>
        <p style="margin:0 0 4px;font-size:11px;color:#9d8fc1;text-transform:uppercase;letter-spacing:1px;">Reason provided</p>
        <p style="margin:0;font-size:13px;color:#c4b5fd;">${reason}</p>
      </td></tr>
    </table>
    ` : ""}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="
          background:${cfg.noteBg};
          border-left:3px solid ${cfg.noteBorder};
          border-radius:0 8px 8px 0;
          padding:10px 14px;
          font-size:13px;
          color:${cfg.noteColor};
          line-height:1.5;
        ">
          ${cfg.noteText}
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#7c6d9e;line-height:1.6;">
      This notification was sent because a change was made to your account by the SecureTodo team.
    </p>
  `;

  const html = emailShell({
    preheader: `Your SecureTodo account has been ${action}.`,
    body,
    footerNote: "This is an automated account notification from SecureTodo.",
  });

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject: cfg.subject, text, html });
    return { delivered: true };
  } catch (error) {
    console.error(`[mail] Account-status email (${action}) failed:`, error.message);
    return { delivered: false };
  }
}
