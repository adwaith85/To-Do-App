/**
 * MongoDB connection helper.
 *
 * Keeps connection logic out of the entry point so `server.js` stays tiny
 * and the database layer has a single home.
 */
import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
  try {
    // Some networks use NAT64 (IPv6-only with translation to IPv4), which the MongoDB driver
    // can hang on when it tries IPv6 first. If you face issues, you might need { family: 4 }.
    // However, for MongoDB Atlas (mongodb+srv://), forcing family: 4 often causes ETIMEDOUT.
    const connection = await mongoose.connect(env.mongoUri);
    console.log(`[db] Connected to MongoDB → ${connection.connection.host}/${connection.connection.name}`);
  } catch (error) {
    console.error("[db] Initial connection failed:", error.message);
    // Exit the process: without a database the API cannot serve requests.
    process.exit(1);
  }

  // Surface errors that happen AFTER the initial connection (e.g. DB goes down).
  mongoose.connection.on("error", (err) => console.error("[db] Runtime error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("[db] Disconnected from MongoDB"));
}

export async function disconnectDB() {
  await mongoose.disconnect();
  console.log("[db] Connection closed");
}