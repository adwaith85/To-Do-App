import { createApp } from "./src/app.js";
import { connectDB, disconnectDB } from "./src/config/db.js";
import { env } from "./src/config/env.js";

async function bootstrap() {
  await connectDB();

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

    // const forceExitTimer = setTimeout(() => {
    //   console.error("[server] Forced shutdown after timeout");
    // }, 10_000);

    forceExitTimer.unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error);
          resolve();
        });
      });

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
}

bootstrap().catch((error) => {
  console.error("[server] Fatal startup error:");
  console.error(error);
  process.exit(1);
});