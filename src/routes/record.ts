import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { coolService } from "../services/coolService.js";
import { eventStore } from "../storage/eventStore.js";
import type { StoredEvent } from "../types/evidence.js";

export const recordRouter = Router();

const recordSchema = z.object({
  agent: z.string().min(1, "Agent name is required"),
  agentVersion: z.string().optional().default("1.0.0"),
  model: z.string().optional().default("Demo-Agent"),
  policyVersion: z.string().optional().default("RefundPolicy-v1"),
  eventType: z.string().optional().default("agent.refund_approved"),
  decision: z.string().min(1, "Decision is required"),
  amount: z.number().nonnegative("Amount must be a non-negative number"),
  reason: z.string().min(1, "Reason is required"),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  payloads: z
    .object({
      input: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
      output: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
    })
    .optional(),
});

recordRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = recordSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        issues: parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }

    const inputData = parseResult.data;

    // Call real CooL SDK
    const coolResult = await coolService.recordDecision(inputData);

    const eventId = eventStore.generateNextEventId();

    const storedEvent: StoredEvent = {
      eventId,
      recordId: coolResult.recordId,
      executionId: coolResult.executionId,
      digest: coolResult.digest,
      evidence: coolResult.evidence,
      agent: inputData.agent,
      agentVersion: inputData.agentVersion,
      model: inputData.model,
      policyVersion: inputData.policyVersion,
      eventType: inputData.eventType,
      decision: inputData.decision,
      amount: inputData.amount,
      reason: inputData.reason,
      timestamp: new Date().toISOString(),
      status: "recorded",
    };

    await eventStore.saveEvent(storedEvent);

    res.status(201).json({
      success: true,
      eventId: storedEvent.eventId,
      recordId: storedEvent.recordId,
      executionId: storedEvent.executionId,
      digest: storedEvent.digest,
      timestamp: storedEvent.timestamp,
      status: storedEvent.status,
      evidence: storedEvent.evidence,
    });
  } catch (err: any) {
    console.error("Error in /api/record:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to record evidence",
    });
  }
});

