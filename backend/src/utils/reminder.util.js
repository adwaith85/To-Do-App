import cron from "node-cron";
import Todo from "../models/todo.model.js";
import User from "../models/user.model.js";
import nodemailer from "nodemailer";
import mongoose from "mongoose";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || "GonnaDo App <no-reply@todoapp.local>";
const MONGO_URI = process.env.MONGO_URI;

let transporter = null;
let reminderTask = null;
let isProcessing = false;

/**
 * Create SMTP transporter only when SMTP is configured.
 */
function getTransporter() {
  if (!transporter && SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

/**
 * Send reminder email.
 */
async function sendReminderEmail(user, todo) {
  const transport = getTransporter();

  if (!transport) {
    console.warn("[reminder] No SMTP configured — skipping email");
    return false;
  }

  // Build checklist items for description
  const descriptionHtml = todo.description
    ? todo.description
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const isCompleted = line.startsWith("[x] ");
          const isItem =
            line.startsWith("[x] ") ||
            line.startsWith("[ ] ") ||
            line.startsWith("• ");

          if (isItem) {
            const text = line.replace(/^(\[x\]|\[ \]|\u2022)\s*/, "");
            return `
              <tr>
                <td style="padding:5px 0;vertical-align:top;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="
                        width:16px;
                        height:16px;
                        border-radius:4px;
                        border:1.5px solid ${isCompleted ? "#8b5cf6" : "rgba(139,92,246,0.4)"};
                        background:${isCompleted ? "rgba(139,92,246,0.3)" : "transparent"};
                        text-align:center;
                        vertical-align:middle;
                        font-size:10px;
                        color:#a78bfa;
                        margin-right:10px;
                      ">${isCompleted ? "✓" : ""}</td>
                      <td style="padding-left:10px;font-size:13px;color:${isCompleted ? "#7c6d9e" : "#c4b5fd"};
                        ${isCompleted ? "text-decoration:line-through;" : ""}line-height:1.5;">${text}</td>
                    </tr>
                  </table>
                </td>
              </tr>`;
          }

          return `
            <tr><td style="padding:4px 0;font-size:13px;color:#b8a9d9;line-height:1.6;">${line}</td></tr>`;
        })
        .join("")
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Todo Reminder</title>
</head>
<body style="margin:0;padding:0;background:#12091f;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#12091f;">
    Reminder: ${todo.task} — due ${new Date(todo.reminderAt).toLocaleString()}&zwnj;&nbsp;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#12091f;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr><td style="
          background:linear-gradient(145deg,#1e1035 0%,#2a1550 60%,#1a0d3a 100%);
          border-radius:20px;
          border:1px solid rgba(139,92,246,0.22);
          box-shadow:0 24px 60px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.06);
          overflow:hidden;
        ">

          <!-- logo strip -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:24px 32px 20px;border-bottom:1px solid rgba(139,92,246,0.15);">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="
                    background:linear-gradient(135deg,#7c3aed,#a855f7);
                    border-radius:10px;
                    padding:7px 14px;
                    font-size:13px;font-weight:800;color:#fff;letter-spacing:0.5px;
                  ">✓ GonnaDo App</td>
                  <td style="padding-left:12px;">
                    <span style="
                      background:rgba(6,182,212,0.15);
                      border:1px solid rgba(6,182,212,0.35);
                      border-radius:6px;
                      padding:4px 10px;
                      font-size:11px;font-weight:700;color:#06b6d4;letter-spacing:0.5px;
                    ">⏰ REMINDER</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- body -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:28px 32px;">

              <p style="margin:0 0 6px;font-size:11px;color:#9d8fc1;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">
                Task Reminder
              </p>
              <h1 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#ede9fe;line-height:1.3;">
                ${todo.task}
              </h1>

              ${descriptionHtml ? `
              <!-- checklist -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="
                background:rgba(139,92,246,0.07);
                border:1px solid rgba(139,92,246,0.18);
                border-radius:12px;
                padding:14px 16px;
                margin:0 0 20px;
              ">
                <tr><td>
                  <p style="margin:0 0 10px;font-size:11px;color:#9d8fc1;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                    Sub-tasks
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${descriptionHtml}
                  </table>
                </td></tr>
              </table>
              ` : ""}

              <!-- due time pill -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="
                background:rgba(6,182,212,0.1);
                border:1.5px solid rgba(6,182,212,0.3);
                border-radius:12px;
                padding:16px 18px;
                margin:0 0 8px;
              ">
                <tr>
                  <td style="font-size:11px;color:#9d8fc1;text-transform:uppercase;letter-spacing:1px;padding-bottom:6px;">
                    ⏰ &nbsp;Reminder scheduled for
                  </td>
                </tr>
                <tr>
                  <td style="font-size:16px;font-weight:700;color:#06b6d4;">
                    ${new Date(todo.reminderAt).toLocaleString()}
                  </td>
                </tr>
              </table>

            </td></tr>
          </table>

          <!-- footer -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="
              padding:16px 32px 22px;
              border-top:1px solid rgba(139,92,246,0.12);
              text-align:center;
            ">
              <p style="margin:0;font-size:11px;color:#6b5a8e;">
                Sent by GonnaDo App · Manage reminders in your account settings
              </p>
            </td></tr>
          </table>

        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transport.sendMail({
      from: MAIL_FROM,
      to: user.email,
      subject: `Reminder: ${todo.task}`,
      html,
    });

    console.log(
      `[reminder] Email sent to ${user.email} for "${todo.task}"`
    );

    return true;
  } catch (error) {
    console.error(
      `[reminder] Failed to send email to ${user.email}:`,
      error.message
    );

    return false;
  }
}

/**
 * Process reminders that are due.
 */
async function processReminders() {
  // Try to reconnect once when the driver is down, instead of
  // silently skipping every run forever.
  if (mongoose.connection.readyState !== 1) {
    console.warn("[reminder] MongoDB is not connected — attempting reconnect");
    try {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
    } catch (error) {
      console.warn("[reminder] Reconnect failed — skipping this run:", error.message);
      return;
    }
  }

  // Prevent overlapping cron executions.
  if (isProcessing) {
    console.warn("[reminder] Previous job still running — skipping this run");
    return;
  }

  isProcessing = true;

  try {
    const now = new Date();

    const dueTodos = await Todo.find({
      reminderAt: {
        $lte: now,
      },
      reminderSent: false,
      isDeleted: false,
      isArchived: false,
    })
      .sort({ reminderAt: 1 })
      .limit(50);

    if (dueTodos.length === 0) {
      return;
    }

    console.log(`[reminder] Found ${dueTodos.length} due reminder(s)`);

    for (const todo of dueTodos) {
      try {
        const user = await User.findById(todo.user).select("email name");

        if (!user) {
          console.warn(
            `[reminder] User not found for todo ${todo._id}`
          );

          // Prevent this reminder from being queried forever.
          todo.reminderSent = true;
          todo.reminderSentAt = new Date();

          await todo.save();

          continue;
        }

        const emailSent = await sendReminderEmail(user, todo);

        // Only mark as sent when email was actually sent.
        if (!emailSent) {
          console.warn(
            `[reminder] Email was not sent for todo ${todo._id}`
          );

          continue;
        }

        todo.reminderSent = true;
        todo.reminderSentAt = new Date();

        todo.history = todo.history || [];

        todo.history.push({
          action: "reminder_sent",
          at: new Date(),
          detail: `Reminder email sent for ${new Date(
            todo.reminderAt
          ).toISOString()}`,
        });

        if (todo.history.length > 200) {
          todo.history = todo.history.slice(-200);
        }

        await todo.save();

        console.log(
          `[reminder] Reminder completed for todo ${todo._id}`
        );
      } catch (error) {
        console.error(
          `[reminder] Failed processing todo ${todo._id}:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error("[reminder] Cron error:", error.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start reminder scheduler.
 */
export function startReminderCron() {
  // Prevent accidentally creating multiple cron jobs.
  if (reminderTask) {
    console.warn("[reminder] Cron job already running");
    return reminderTask;
  }

  reminderTask = cron.schedule(
    "* * * * *",
    async () => {
      await processReminders();
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log(
    "[reminder] Cron job started (checks every minute)"
  );

  return reminderTask;
}

/**
 * Stop reminder scheduler.
 */
export function stopReminderCron() {
  if (reminderTask) {
    reminderTask.stop();
    reminderTask = null;

    console.log("[reminder] Cron job stopped");
  }
}