import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { recordRouter } from "./routes/record.js";
import { verifyRouter } from "./routes/verify.js";
import { eventsRouter } from "./routes/events.js";
import { refundRouter } from "./routes/refund.js";

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
        "POST /api/refund",
        "POST /api/refund/:eventId/verify",
        "POST /api/verify",
        "GET  /api/events",
        "GET  /api/events/:eventId",
        "POST /api/events/:eventId/tamper-demo",
        "POST /api/verify-tampered",
      ],
    });
  });

  // Unified API router supporting both /api prefix and rewritten paths
  const apiRouter = express.Router();
  apiRouter.use("/health", healthRouter);
  apiRouter.use("/record", recordRouter);
  apiRouter.use("/refund", refundRouter);
  apiRouter.use("/verify", verifyRouter);
  apiRouter.use("/verify-tampered", (req, res, next) => {
    req.url = "/verify-tampered";
    verifyRouter(req, res, next);
  });
  apiRouter.use("/events", eventsRouter);

  app.use("/api", apiRouter);
  app.use(apiRouter);

  // Serve static assets from built frontend if available
  if (fs.existsSync(config.frontendDistDir)) {
    app.use(express.static(config.frontendDistDir));
  }

  // SPA fallback for non-API routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    const indexPath = path.join(config.frontendDistDir, "index.html");
    if (req.method === "GET" && !req.path.startsWith("/api") && fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });

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

