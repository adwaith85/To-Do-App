/**
 * Express application assembly — middleware pipeline + route table.
 *
 * Kept separate from server.js so the app can be imported by tests
 * without opening a port or connecting to a database.
 */
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import todoRoutes from "./routes/todo.routes.js";
import { apiLimiter } from "./middleware/rateLimiter.middleware.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";

export function createApp() {
  const app = express();

  /* ---- Security & platform middleware ---- */

  // Sets sensible security headers (X-Content-Type-Options, HSTS in prod...).
  app.use(helmet());

  // Trust the first proxy hop so req.ip / rate limiting see real client IPs.
  if (env.isProd) app.set("trust proxy", 1);

  // Allow only the frontend origin, WITH credentials (refresh cookie).
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  // Reject absurdly large bodies early (DoS surface reduction).
  app.use(express.json({ limit: "10kb" }));

  // Needed to read the httpOnly refresh-token cookie.
  app.use(cookieParser());

  /* ---- Lightweight request logger (development only) ---- */

  if (!env.isProd) {
    app.use((req, _res, next) => {
      console.log(`[http] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  /* ---- Global API rate limit + routes ---- */

  const api = express.Router();
  api.use(apiLimiter);

  api.get("/health", (_req, res) =>
    res.json({ success: true, message: "API is healthy", uptime: process.uptime() })
  );

  api.use("/auth", authRoutes);
  api.use("/todos", todoRoutes);

  app.use("/api", api);

  // Root info page (kept from the original backend for quick checks).
  app.get("/", (_req, res) => res.send("Backend is running!"));

  /* ---- Error pipeline (must stay last) ---- */

  app.use(notFoundHandler); // unmatched routes → 404
  app.use(errorHandler);    // everything throwable → clean JSON

  return app;
}
