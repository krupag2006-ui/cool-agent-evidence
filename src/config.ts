import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  coolApplicationId: process.env.COOL_APPLICATION_ID || "refund-agent",
  frontendOrigins: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",").map((s) => s.trim())
    : ["http://localhost:3000", "http://localhost:5173"],
  dataDir: path.join(rootDir, "data"),
  eventsFilePath: path.join(rootDir, "data", "events.json"),
};

