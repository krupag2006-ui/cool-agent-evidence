import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { eventStore } from "../storage/eventStore.js";
import { coolService } from "../services/coolService.js";
import type { TamperedEventRecord } from "../types/evidence.js";

export const eventsRouter = Router();

/**
 * GET /api/events
 * Lists all recorded events (most recent first) for frontend dashboard.
 */
eventsRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const events = await eventStore.listEvents();
    res.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (err: any) {
    console.error("Error in GET /api/events:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to list events",
    });
  }
});

/**
 * GET /api/events/:eventId
 * Returns full event details, metadata, and full CooL evidence receipt.
 */
eventsRouter.get("/:eventId", async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = String(req.params.eventId);
    const event = await eventStore.getEvent(eventId);

    if (!event) {
      res.status(404).json({
        success: false,
        error: `Event '${eventId}' not found`,
      });
      return;
    }

    res.json({
      success: true,
      event,
    });
  } catch (err: any) {
    console.error(`Error in GET /api/events/${req.params.eventId}:`, err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to retrieve event",
    });
  }
});

/**
 * POST /api/events/:eventId/tamper-demo
 * Safely creates an isolated tampered copy of the original evidence receipt for demonstration.
 * Original evidence is NOT modified.
 */
eventsRouter.post("/:eventId/tamper-demo", async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = String(req.params.eventId);
    const event = await eventStore.getEvent(eventId);

    if (!event) {
      res.status(404).json({
        success: false,
        error: `Event '${eventId}' not found`,
      });
      return;
    }

    // Determine tamper type (default to metadata_hash as specified by CooL repo)
    const tamperType = req.body?.tamperType === "binding_hash" ? "binding_hash" : "metadata_hash";
    const tamperResult = coolService.createTamperedCopy(event.evidence, tamperType);

    const tamperId = `tamper_${crypto.randomBytes(6).toString("hex")}`;

    const record: TamperedEventRecord = {
      tamperId,
      originalEventId: event.eventId,
      tamperedEvidence: tamperResult.tamperedEvidence,
      tamperedField: tamperResult.tamperedField,
      originalValue: tamperResult.originalValue,
      tamperedValue: tamperResult.tamperedValue,
      description: tamperResult.description,
      createdAt: new Date().toISOString(),
    };

    eventStore.saveTamperedRecord(record);

    res.json({
      success: true,
      tamperId: record.tamperId,
      originalEventId: record.originalEventId,
      tamperedField: record.tamperedField,
      originalValue: record.originalValue,
      tamperedValue: record.tamperedValue,
      description: record.description,
      tamperedEvidence: record.tamperedEvidence,
      verificationPrompt: "Call POST /api/verify-tampered with this tamperId to see CooL detect the modification.",
    });
  } catch (err: any) {
    console.error(`Error in POST /api/events/${req.params.eventId}/tamper-demo:`, err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to generate tampered demo copy",
    });
  }
});
