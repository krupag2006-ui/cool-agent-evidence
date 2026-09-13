import type { Evidence, Verdict } from "cool-nwc";

export interface RefundRecordInput {
  agent: string;
  agentVersion?: string;
  model?: string;
  policyVersion?: string;
  eventType?: string;
  decision: string;
  amount: number;
  reason: string;
  customerId?: string;
  orderId?: string;
  payloads?: {
    input?: Record<string, unknown> | string;
    output?: Record<string, unknown> | string;
  };
}

export interface StoredEvent {
  eventId: string;
  recordId: string;
  executionId: string;
  digest: string;
  evidence: Evidence;
  agent: string;
  agentVersion: string;
  model: string;
  policyVersion: string;
  eventType: string;
  decision: string;
  amount: number;
  reason: string;
  customerId?: string;
  orderId?: string;
  timestamp: string;
  status: "recorded" | "verified" | "tampered_detected";
}

export interface StoredEventSummary {
  eventId: string;
  agent: string;
  decision: string;
  amount: number;
  reason: string;
  timestamp: string;
  recordId: string;
  executionId: string;
  status: string;
  digest: string;
}

export interface TamperedEventRecord {
  tamperId: string;
  originalEventId: string;
  tamperedEvidence: Evidence;
  tamperedField: string;
  originalValue: string;
  tamperedValue: string;
  description: string;
  createdAt: string;
}

export interface NormalizedVerdict {
  valid: boolean;
  schema: string;
  subject: {
    kind: string;
    subject: string;
    issuedAt: string;
    recordId: string;
    keyId: string;
    tee: string;
  } | null;
  checks: {
    binding: { status: string; detail: string };
    signature: { status: string; detail: string };
    inclusion: { status: string; detail: string };
    witnesses: { status: string; detail: string };
    attestation: { status: string; detail: string };
    enclave: { status: string; detail: string };
    anchor: { status: string; detail: string };
  };
  reasons: readonly string[];
  formattedVerdict?: string;
  attestationDisclaimer: string;
}

