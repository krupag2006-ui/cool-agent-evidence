import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { coolService } from "../services/coolService.js";
import { refundBot } from "../services/refundBot.js";
import { eventStore } from "../storage/eventStore.js";
import type { StoredEvent } from "../types/evidence.js";

export const refundRouter = Router();

function buildEvidenceStatus(
  decision: string,
  verification: Awaited<ReturnType<typeof coolService.verify>>
) {
  return {
    decision,
    evidence: "RECORDED" as const,
    verification: verification.valid ? ("VALID" as const) : ("INVALID" as const),
    checks: verification.checks,
    reasons: verification.reasons,
  };
}

const refundRequestSchema = z.object({
  amount: z.number().finite().nonnegative("Amount must be a non-negative number"),
  reason: z.string().trim().min(1, "Reason is required"),
  customerId: z.string().trim().min(1, "Customer ID is required"),
  orderId: z.string().trim().min(1, "Order ID is required"),
});

refundRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = refundRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        issues: parseResult.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const decision = refundBot.evaluate(parseResult.data);
    const coolResult = await coolService.recordDecision(decision);
    const eventId = eventStore.generateNextEventId();
    const storedEvent: StoredEvent = {
      eventId,
      recordId: coolResult.recordId,
      executionId: coolResult.executionId,
      digest: coolResult.digest,
      evidence: coolResult.evidence,
      agent: decision.agent,
      agentVersion: decision.agentVersion,
      model: decision.model,
      policyVersion: decision.policyVersion,
      eventType: decision.eventType,
      decision: decision.decision,
      amount: decision.amount,
      reason: decision.reason,
      customerId: decision.customerId,
      orderId: decision.orderId,
      timestamp: new Date().toISOString(),
      status: "recorded",
    };

    await eventStore.saveEvent(storedEvent);
    const verification = await coolService.verify(storedEvent.evidence);
    if (verification.valid) {
      await eventStore.updateEventStatus(storedEvent.eventId, "verified");
      storedEvent.status = "verified";
    }

    res.status(201).json({
      success: true,
      decision,
      eventId: storedEvent.eventId,
      recordId: storedEvent.recordId,
      executionId: storedEvent.executionId,
      digest: storedEvent.digest,
      timestamp: storedEvent.timestamp,
      status: storedEvent.status,
      evidence: storedEvent.evidence,
      verification,
      evidenceStatus: buildEvidenceStatus(storedEvent.decision, verification),
    });
  } catch (err: any) {
    console.error("Error in /api/refund:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to process refund",
    });
  }
});

refundRouter.post("/:eventId/verify", async (req: Request, res: Response): Promise<void> => {
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

    const verification = await coolService.verify(event.evidence);
    if (verification.valid) {
      await eventStore.updateEventStatus(event.eventId, "verified");
    }

    res.json({
      success: true,
      decision: {
        agent: event.agent,
        agentVersion: event.agentVersion,
        model: event.model,
        policyVersion: event.policyVersion,
        eventType: event.eventType,
        decision: event.decision,
        amount: event.amount,
        reason: event.reason,
        customerId: event.customerId,
        orderId: event.orderId,
      },
      eventId: event.eventId,
      recordId: event.recordId,
      digest: event.digest,
      evidence: event.evidence,
      verification,
      evidenceStatus: buildEvidenceStatus(event.decision, verification),
    });
  } catch (err: any) {
    console.error(`Error in /api/refund/${req.params.eventId}/verify:`, err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to verify refund evidence",
    });
  }
});