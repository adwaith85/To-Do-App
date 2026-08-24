/**
 * Server entry point.
 *
 * Responsibilities only:
 *   1. connect to MongoDB
 *   2. start HTTP listener
 *   3. graceful shutdown on SIGINT/SIGTERM
 *
 * All Express wiring lives in src/app.js.
 */
import { createApp } from "./src/app.js";
import { connectDB, disconnectDB } from "./src/config/db.js";
import { env } from "./src/config/env.js";

async function bootstrap() {
  await connectDB();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  /* ---- Graceful shutdown: stop accepting, close DB, exit ---- */
  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if connections refuse to drain within 10s.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  console.error("[server] Fatal startup error:", error);
  process.exit(1);
});
