import type { RefundRecordInput } from "../types/evidence.js";

export interface RefundRequest {
  amount: number;
  reason: string;
  customerId: string;
  orderId: string;
}

export interface RefundDecision extends RefundRecordInput {
  decision: "REFUND_APPROVED" | "REFUND_REJECTED";
  agent: "RefundBot";
  agentVersion: "1.0.0";
  model: "RefundBot-PolicyEngine";
  policyVersion: "RefundPolicy-v1";
  eventType: "agent.refund_approved" | "agent.refund_rejected";
  customerId: string;
  orderId: string;
}

const APPROVAL_LIMIT = 10_000;
const VALID_REASONS = new Set([
  "product_damaged",
  "defective_product",
  "wrong_item",
  "not_received",
]);

export class RefundBot {
  public evaluate(request: RefundRequest): RefundDecision {
    const normalizedReason = request.reason.trim().toLowerCase();
    const approved = request.amount <= APPROVAL_LIMIT && VALID_REASONS.has(normalizedReason);

    return {
      decision: approved ? "REFUND_APPROVED" : "REFUND_REJECTED",
      reason: request.reason,
      amount: request.amount,
      customerId: request.customerId,
      orderId: request.orderId,
      policyVersion: "RefundPolicy-v1",
      agent: "RefundBot",
      agentVersion: "1.0.0",
      model: "RefundBot-PolicyEngine",
      eventType: approved ? "agent.refund_approved" : "agent.refund_rejected",
    };
  }
}

export const refundBot = new RefundBot();