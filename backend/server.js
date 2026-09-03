import { createApp } from "./src/app.js";
import { connectDB, disconnectDB } from "./src/config/db.js";
import { env } from "./src/config/env.js";
import { startReminderCron } from "./src/utils/reminder.util.js";

async function bootstrap() {
  await connectDB();
  startReminderCron();

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(
      `[server] API listening on http://localhost:${env.port} (${env.nodeEnv})`
    );
  });

  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) return;

    isShuttingDown = true;
    console.log(`\n[server] ${signal} received — shutting down...`);

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error);
          resolve();
        });
      });

      await disconnectDB();
      console.log("[server] Shutdown complete");
    } catch (error) {
      console.error("[server] Shutdown error:", error);
    }
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  console.error("[server] Fatal startup error:");
  console.error(error);
});
