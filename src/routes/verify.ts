import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { coolService } from "../services/coolService.js";
import { eventStore } from "../storage/eventStore.js";
import type { Evidence } from "cool-nwc";

export const verifyRouter = Router();

const verifySchema = z.object({
  eventId: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => data.eventId || data.evidence, {
  message: "Either eventId or evidence object must be provided",
});

const verifyTamperedSchema = z.object({
  tamperId: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => data.tamperId || data.evidence, {
  message: "Either tamperId or evidence object must be provided",
});

/**
 * POST /api/verify
 * Verifies standard evidence receipt using the official CooL verifier.
 */
verifyRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = verifySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        issues: parseResult.error.issues.map((i) => ({ message: i.message })),
      });
      return;
    }

    const { eventId, evidence: rawEvidence } = parseResult.data;

    let targetEvidence: Evidence;
    let storedEvent = null;

    if (eventId) {
      storedEvent = await eventStore.getEvent(eventId);
      if (!storedEvent) {
        res.status(404).json({
          success: false,
          error: `Event '${eventId}' not found in event store`,
        });
        return;
      }
      targetEvidence = storedEvent.evidence;
    } else {
      targetEvidence = rawEvidence as unknown as Evidence;
    }

    // Call real CooL verifier
    const verdict = await coolService.verify(targetEvidence);

    if (storedEvent && verdict.valid) {
      await eventStore.updateEventStatus(storedEvent.eventId, "verified");
    }

    res.json({
      success: true,
      valid: verdict.valid,
      eventId: storedEvent?.eventId || null,
      recordId: verdict.subject?.recordId || null,
      subject: verdict.subject,
      checks: verdict.checks,
      reasons: verdict.reasons,
      formattedVerdict: verdict.formattedVerdict,
      attestationDisclaimer: verdict.attestationDisclaimer,
    });
  } catch (err: any) {
    console.error("Error in /api/verify:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to verify evidence",
    });
  }
});

/**
 * POST /api/verify-tampered
 * Verifies a tampered evidence copy to demonstrate real CooL cryptographic detection.
 */
verifyRouter.post("/verify-tampered", async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = verifyTamperedSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        issues: parseResult.error.issues.map((i) => ({ message: i.message })),
      });
      return;
    }

    const { tamperId, evidence: rawEvidence } = parseResult.data;

    let targetEvidence: Evidence;
    let tamperedRecord = null;

    if (tamperId) {
      tamperedRecord = eventStore.getTamperedRecord(tamperId);
      if (!tamperedRecord) {
        res.status(404).json({
          success: false,
          error: `Tampered record '${tamperId}' not found`,
        });
        return;
      }
      targetEvidence = tamperedRecord.tamperedEvidence;
    } else {
      targetEvidence = rawEvidence as unknown as Evidence;
    }

    // Call real CooL verifier on tampered evidence
    const verdict = await coolService.verify(targetEvidence);

    res.json({
      success: true,
      valid: verdict.valid,
      tamperId: tamperedRecord?.tamperId || null,
      originalEventId: tamperedRecord?.originalEventId || null,
      tamperedField: tamperedRecord?.tamperedField || "custom",
      tamperedDescription: tamperedRecord?.description || "Custom tampered payload verified",
      checks: verdict.checks,
      reasons: verdict.reasons,
      formattedVerdict: verdict.formattedVerdict,
      detectionConfirmed: !verdict.valid,
    });
  } catch (err: any) {
    console.error("Error in /api/verify-tampered:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to verify tampered evidence",
    });
  }
});

