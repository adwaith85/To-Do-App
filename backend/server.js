import { createApp } from "./src/app.js";
import { connectDB, disconnectDB } from "./src/config/db.js";
import { env } from "./src/config/env.js";
import {
  startReminderCron,
  stopReminderCron,
} from "./src/utils/reminder.util.js";

async function bootstrap() {
  let server;

  try {
    // 1. MongoDB MUST connect successfully first
    await connectDB();

    console.log("[server] Database ready");

    // 2. Start Express only after DB is ready
    const app = createApp();

    server = app.listen(env.port, () => {
      console.log(
        `[server] API listening on http://localhost:${env.port} (${env.nodeEnv})`
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

    await disconnectDB();

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

    // Make absolutely sure nothing remains running
    try {
      await disconnectDB();
    } catch {}

    process.exit(1);
  }
}

bootstrap();