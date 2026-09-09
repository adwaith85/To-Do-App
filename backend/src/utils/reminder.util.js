import cron from "node-cron";
import Todo from "../models/todo.model.js";
import User from "../models/user.model.js";
import { env } from "../config/env.js";
import nodemailer from "nodemailer";
import mongoose from "mongoose";

let transporter = null;
let reminderTask = null;
let isProcessing = false;

/**
 * Create SMTP transporter only when SMTP is configured.
 */
function getTransporter() {
  if (!transporter && env.smtp.host) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: false,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>

    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',sans-serif;">
      <div style="
        max-width:480px;
        margin:40px auto;
        background:linear-gradient(135deg,#1e293b,#0f172a);
        border-radius:16px;
        border:1px solid rgba(255,255,255,0.1);
        padding:32px;
        color:#e2e8f0;
      ">

        <div style="text-align:center;margin-bottom:24px;">
          <div style="
            display:inline-block;
            background:linear-gradient(135deg,#06b6d4,#10b981);
            border-radius:12px;
            padding:12px 20px;
            color:#0f172a;
            font-weight:800;
            font-size:18px;
          ">
            Todo Reminder
          </div>
        </div>

        <h2 style="
          font-size:16px;
          font-weight:600;
          margin:0 0 16px;
          color:#f1f5f9;
        ">
          ${todo.task}
        </h2>

        ${
          todo.description
            ? `
              <div style="margin:0 0 16px;">
                ${todo.description
                  .split("\n")
                  .filter((line) => line.trim())
                  .map((line) => {
                    if (
                      line.startsWith("[x] ") ||
                      line.startsWith("[ ] ") ||
                      line.startsWith("• ")
                    ) {
                      const completed = line.startsWith("[x] ");

                      return `
                        <span style="
                          display:block;
                          font-size:14px;
                          line-height:1.6;
                          padding-left:14px;
                          position:relative;
                          ${
                            completed
                              ? "color:#64748b;text-decoration:line-through;"
                              : "color:#94a3b8;"
                          }
                        ">
                          <span style="
                            position:absolute;
                            left:0;
                            top:8px;
                            width:5px;
                            height:5px;
                            background:#a78bfa;
                            transform:rotate(45deg);
                          "></span>

                          ${completed ? "&#10003; " : ""}

                          ${line.replace(
                            /^(\[x\]|\[ \]|\u2022)\s*/,
                            ""
                          )}
                        </span>
                      `;
                    }

                    return `
                      <p style="
                        font-size:14px;
                        color:#94a3b8;
                        margin:0 0 8px;
                        line-height:1.6;
                      ">
                        ${line}
                      </p>
                    `;
                  })
                  .join("")}
              </div>
            `
            : ""
        }

        <div style="
          background:rgba(255,255,255,0.05);
          border-radius:10px;
          padding:16px;
          margin:16px 0;
        ">
          <p style="
            font-size:12px;
            color:#64748b;
            margin:0 0 8px;
            text-transform:uppercase;
            letter-spacing:0.05em;
          ">
            Reminder scheduled for
          </p>

          <p style="
            font-size:14px;
            font-weight:600;
            color:#06b6d4;
            margin:0;
          ">
            ${new Date(todo.reminderAt).toLocaleString()}
          </p>
        </div>

        <p style="
          font-size:12px;
          color:#475569;
          text-align:center;
          margin:24px 0 0;
        ">
          Sent by SecureTodo
        </p>

      </div>
    </body>
    </html>
  `;

  try {
    await transport.sendMail({
      from: env.smtp.from,
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
  // Do not query MongoDB when disconnected.
  if (mongoose.connection.readyState !== 1) {
    console.warn("[reminder] MongoDB is not connected — skipping this run");
    return;
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