import cron from "node-cron";
import Todo from "../models/todo.model.js";
import User from "../models/user.model.js";
import { env } from "../config/env.js";
import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (!transporter && env.smtp.host) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: false,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

async function sendReminderEmail(user, todo) {
  const transport = getTransporter();
  if (!transport) {
    console.warn("[reminder] No SMTP configured — skipping email");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:32px;color:#e2e8f0;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#10b981);border-radius:12px;padding:12px 20px;color:#0f172a;font-weight:800;font-size:18px;">Todo Reminder</div>
        </div>
        <h2 style="font-size:16px;font-weight:600;margin:0 0 16px;color:#f1f5f9;">${todo.task}</h2>
        ${todo.description ? `<p style="font-size:14px;color:#94a3b8;margin:0 0 16px;line-height:1.6;">${todo.description}</p>` : ""}
        <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:16px;margin:16px 0;">
          <p style="font-size:12px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Reminder scheduled for</p>
          <p style="font-size:14px;font-weight:600;color:#06b6d4;margin:0;">${new Date(todo.reminderAt).toLocaleString()}</p>
        </div>
        <p style="font-size:12px;color:#475569;text-align:center;margin:24px 0 0;">Sent by SecureTodo</p>
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
    console.log(`[reminder] Email sent to ${user.email} for "${todo.task}"`);
  } catch (err) {
    console.error("[reminder] Failed to send email:", err.message);
  }
}

export function startReminderCron() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const dueTodos = await Todo.find({
        reminderAt: { $lte: now },
        reminderSent: false,
        isDeleted: false,
        isArchived: false,
      }).limit(50);

      for (const todo of dueTodos) {
        const user = await User.findById(todo.user).select("email name");
        if (user) {
          await sendReminderEmail(user, todo);
        }
        todo.reminderSent = true;
        todo.reminderSentAt = new Date();
        todo.history = todo.history || [];
        todo.history.push({ action: "reminder_sent", at: new Date(), detail: `Reminder email sent for ${new Date(todo.reminderAt).toISOString()}` });
        if (todo.history.length > 200) todo.history = todo.history.slice(-200);
        await todo.save();
      }
    } catch (err) {
      console.error("[reminder] Cron error:", err.message);
    }
  });
  console.log("[reminder] Cron job started (checks every minute)");
}
