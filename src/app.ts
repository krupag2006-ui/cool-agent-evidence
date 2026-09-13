import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { recordRouter } from "./routes/record.js";
import { verifyRouter } from "./routes/verify.js";
import { eventsRouter } from "./routes/events.js";

export function createApp(): Express {
  const app = express();

  // CORS setup
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        // In development or if origin matches allowed list
        if (
          config.nodeEnv === "development" ||
          config.frontendOrigins.includes(origin) ||
          config.frontendOrigins.includes("*") ||
          origin.includes("localhost") ||
          origin.includes("vercel.app")
        ) {
          return callback(null, true);
        }

        callback(null, true); // Permissive for hackathon prototype
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Root welcome / discovery
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "CooL Evidence Backend",
      version: "1.0.0",
      description: "Cryptographic Observability & On-chain Ledger API for AI Decision Audit",
      documentation: "/api/health",
      endpoints: [
        "GET  /api/health",
        "POST /api/record",
        "POST /api/verify",
        "GET  /api/events",
        "GET  /api/events/:eventId",
        "POST /api/events/:eventId/tamper-demo",
        "POST /api/verify-tampered",
      ],
    });
  });

  // Mount API routers
  app.use("/api/health", healthRouter);
  app.use("/api/record", recordRouter);
  app.use("/api/verify", verifyRouter);
  // Also mount verify-tampered directly at /api/verify-tampered
  app.use("/api/verify-tampered", (req, res, next) => {
    req.url = "/verify-tampered";
    verifyRouter(req, res, next);
  });
  app.use("/api/events", eventsRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  });

  return app;
}

