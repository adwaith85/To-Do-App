import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
  if (!env.mongoUri) {
    throw new Error("MONGO_URI is missing from .env");
  }

  if (mongoose.connection.readyState === 1) {
    console.log("[db] Already connected");
    return;
  }

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log(
      `[db] Connected → ${mongoose.connection.host}/${mongoose.connection.name}`
    );
  } catch (error) {
    console.error("[db] Connection failed:", error.message);

    // Make sure failed connection doesn't remain around
    try {
      await mongoose.disconnect();
    } catch {}

    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("[db] Connection closed");
  }
}

mongoose.connection.on("error", (error) => {
  console.error("[db] Runtime error:", error.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[db] MongoDB disconnected.");
});

mongoose.connection.on("reconnected", () => {
  console.log("[db] MongoDB reconnected.");
});