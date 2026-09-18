import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import path from "path";

import authRoutes from "./routes/auth.routes.js";
import todoRoutes from "./routes/todo.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import { apiLimiter } from "./middleware/rateLimiter.middleware.js";
import { ensureCsrfCookie } from "./middleware/csrf.middleware.js";
import {
  notFoundHandler,
  errorHandler,
} from "./middleware/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";

const CLIENT_URL = (
  process.env.CLIENT_URL || "http://localhost:5173"
)
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

export function createApp() {
  const app = express();

  /* ---- Security & platform middleware ---- */

  app.use(helmet());

  // Trust the first proxy hop (Caddy) in production.
  if (isProd) {
    app.set("trust proxy", 1);
  }

  // Force HTTPS in production if the proxy reports HTTP.
  if (isProd) {
    app.use((req, res, next) => {
      if (req.headers["x-forwarded-proto"] === "http") {
        return res.redirect(
          308,
          `https://${req.headers.host}${req.originalUrl}`
        );
      }

      next();
    });
  }

  /* ---- CORS ---- */

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests without an Origin header.
        // Useful for curl, server-to-server requests, etc.
        if (!origin) {
          return callback(null, true);
        }

        // Allow only configured frontend origins.
        if (CLIENT_URL.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked: ${origin}`));
      },

      credentials: true,

      methods: [
        "GET",
        "POST",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],
    })
  );

  /* ---- Body & cookies ---- */

  app.use(express.json({ limit: "10kb" }));

  app.use(cookieParser());

  /* ---- CSRF ---- */

  app.use(ensureCsrfCookie);

  /* ---- Request logger ---- */

  if (!isProd) {
    app.use((req, _res, next) => {
      console.log(`[http] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  /* ---- API ---- */

  const api = express.Router();

  api.use(apiLimiter);

  api.get("/health", (_req, res) => {
    res.json({
      success: true,
      message: "API is healthy",
      uptime: process.uptime(),
    });
  });

  api.use(
    "/uploads",
    express.static(path.join(__dirname, "../../uploads"))
  );

  api.use("/auth", authRoutes);
  api.use("/todos", todoRoutes);
  api.use("/admin", adminRoutes);
  api.use("/contact", contactRoutes);

  app.use("/api", api);

  /* ---- Root ---- */

  app.get("/", (_req, res) => {
    res.send("Backend is running!");
  });

  /* ---- Error handling ---- */

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

