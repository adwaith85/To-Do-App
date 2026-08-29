import mongoose from "mongoose";
import { env } from "./env.js";

const CONNECT_TIMEOUT_MS = 10_000;

export async function connectDB() {
  try {
    // Prevent unnecessary duplicate connection attempts.
    if (mongoose.connection.readyState === 1) {
      console.log("[db] Already connected");
      return;
    }

    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
      bufferCommands: false,
      maxPoolSize: 10,
      retryWrites: true,
    });

    console.log(
      `[db] Connected → ${mongoose.connection.host}/${mongoose.connection.name}`
    );
  } catch (error) {
    console.error("[db] Could not connect to MongoDB:");
    console.error(error);

    // Let server.js decide what to do.
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("[db] Connection closed");
  }
}

mongoose.connection.on("error", (err) => {
  console.error("[db] Runtime error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn(
    "[db] Disconnected — subsequent queries will fail fast until reconnect."
  );
});