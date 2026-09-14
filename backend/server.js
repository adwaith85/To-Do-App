import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const PORT = parseInt(process.env.PORT, 10);
const NODE_ENV = process.env.NODE_ENV || "development";

// ES module imports are hoisted and evaluated BEFORE this file's body runs,
// so the app modules must be loaded AFTER dotenv.config() to see real env
// values (SMTP creds, JWT secrets, rate limits, etc.).
const { createApp } = await import("./src/app.js");
const { startReminderCron, stopReminderCron } = await import(
  "./src/utils/reminder.util.js"
);

async function bootstrap() {
  let server;

  try {
    // 1. MongoDB MUST connect successfully first
    await mongoose.connect(process.env.MONGO_URI);

    console.log("[server] Database ready");

    // 2. Start Express only after DB is ready
    const app = createApp();

    server = app.listen(PORT, () => {
      console.log(
        `[server] API listening on http://localhost:${PORT} (${NODE_ENV})`
      );
    });

    // 3. Start cron only after DB + server are ready
    startReminderCron();

    let isShuttingDown = false;

    const shutdown = async (signal) => {
      if (isShuttingDown) return;

      isShuttingDown = true;

      console.log(`\n[server] ${signal} received — shutting down...`);

      try {
        stopReminderCron();

        if (server) {
          await new Promise((resolve) => {
            server.close(() => resolve());
          });
        }

        console.log("[server] Shutdown complete");
        process.exit(0);
      } catch (error) {
        console.error("[server] Shutdown error:", error);
        process.exit(1);
      }
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("[server] Failed to start:");
    console.error(error.message);

    process.exit(1);
  }
}

bootstrap();