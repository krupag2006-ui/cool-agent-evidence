import { Router, type Request, type Response } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    cool: "ready",
    sdk: "cool-nwc",
    sdkVersion: "3.0.0",
    attestation: "simulated (local node runtime)",
    timestamp: new Date().toISOString(),
  });
});

