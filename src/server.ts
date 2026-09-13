import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🚀 CooL Evidence Backend running on port ${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔐 CooL Application ID: ${config.coolApplicationId}`);
  console.log(`🌐 CORS Allowed Origins: ${config.frontendOrigins.join(", ")}`);
  console.log(`====================================================`);
  console.log(`Available Endpoints:`);
  console.log(`  GET  http://localhost:${config.port}/api/health`);
  console.log(`  POST http://localhost:${config.port}/api/record`);
  console.log(`  POST http://localhost:${config.port}/api/verify`);
  console.log(`  GET  http://localhost:${config.port}/api/events`);
  console.log(`  GET  http://localhost:${config.port}/api/events/:eventId`);
  console.log(`  POST http://localhost:${config.port}/api/events/:eventId/tamper-demo`);
  console.log(`  POST http://localhost:${config.port}/api/verify-tampered`);
  console.log(`====================================================`);
});

process.on("SIGINT", () => {
  console.log("Shutting down server gracefully (SIGINT)...");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("Shutting down server gracefully (SIGTERM)...");
  server.close(() => process.exit(0));
});

