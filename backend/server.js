import { createApp } from "./src/app.js";
import { connectDB, disconnectDB } from "./src/config/db.js";
import { env } from "./src/config/env.js";
import { startReminderCron } from "./src/utils/reminder.util.js";

async function bootstrap() {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Start reminder scheduler after DB is ready
    startReminderCron();

    // Create Express application
    const app = createApp();

    // Start HTTP server
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

      server.close(async (error) => {
        if (error) {
          console.error("[server] Error closing HTTP server:", error);
        }

        try {
          await disconnectDB();
          console.log("[server] Shutdown complete");
          process.exit(0);
        } catch (dbError) {
          console.error("[server] Shutdown error:", dbError);
          process.exit(1);
        }
      });
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