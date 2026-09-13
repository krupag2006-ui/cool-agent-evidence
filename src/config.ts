import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const config = {
  isVercel,
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  coolApplicationId: process.env.COOL_APPLICATION_ID || "refund-agent",
  frontendOrigins: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",").map((s) => s.trim())
    : ["http://localhost:3000", "http://localhost:5173"],
  dataDir: isVercel ? "/tmp" : path.join(rootDir, "data"),
  eventsFilePath: isVercel ? "/tmp/events.json" : path.join(rootDir, "data", "events.json"),
  seedEventsFilePath: path.join(rootDir, "data", "events.json"),
  frontendDistDir: path.join(rootDir, "dist", "frontend"),
};
