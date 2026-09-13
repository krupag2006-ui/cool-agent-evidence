import {
  CooL,
  verifyEvidence,
  formatVerdict,
  CooLError,
  type Evidence,
  type EvidenceResult,
  type Verdict,
} from "cool-nwc";
import { config } from "../config.js";
import type { NormalizedVerdict, RefundRecordInput } from "../types/evidence.js";

export class CooLService {
  private coolClient: CooL;

  constructor() {
    this.coolClient = new CooL({
      applicationId: config.coolApplicationId,
    });
  }

  /**
   * Records execution evidence for an agent decision via CooL SDK.
   * Metadata and payloads are committed via salted hashes; raw payload plaintext is not retained in receipt.
   */
  public async recordDecision(input: RefundRecordInput): Promise<EvidenceResult> {
    try {
      const eventType = input.eventType || "agent.refund_approved";

      const metadata: Record<string, unknown> = {
        agent: input.agent,
        agentVersion: input.agentVersion || "1.0.0",
        model: input.model || "Demo-Agent",
        policyVersion: input.policyVersion || "RefundPolicy-v1",
        decision: input.decision,
        amount: input.amount,
        reason: input.reason,
        timestamp: new Date().toISOString(),
      };

      if (input.customerId) metadata.customerId = input.customerId;
      if (input.orderId) metadata.orderId = input.orderId;

      const payloads: { input?: string; output?: string } = {};

      if (input.payloads?.input) {
        payloads.input =
          typeof input.payloads.input === "string"
            ? input.payloads.input
            : JSON.stringify(input.payloads.input);
      } else if (input.customerId || input.orderId) {
        payloads.input = JSON.stringify({
          customerId: input.customerId,
          orderId: input.orderId,
          claimReason: input.reason,
          claimedAmount: input.amount,
        });
      }

      if (input.payloads?.output) {
        payloads.output =
          typeof input.payloads.output === "string"
            ? input.payloads.output
            : JSON.stringify(input.payloads.output);
      } else {
        payloads.output = JSON.stringify({
          decision: input.decision,
          authorizedAmount: input.amount,
          policy: input.policyVersion || "RefundPolicy-v1",
          evaluatedAt: new Date().toISOString(),
        });
      }

      const result = await this.coolClient.record({
        type: eventType,
        metadata,
        payloads,
      });

      return result;
    } catch (err) {
      if (err instanceof CooLError) {
        throw new Error(`CooL SDK Error [${err.code}]: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * Verifies an evidence receipt offline using the official CooL verifier.
   * Returns a normalized structured verdict preserving all 7 verification domains.
   */
  public async verify(evidence: Evidence): Promise<NormalizedVerdict> {
    try {
      const verdict: Verdict = await verifyEvidence(evidence);
      const formatted = formatVerdict(verdict);

      return this.normalizeVerdict(verdict, formatted);
    } catch (err) {
      if (err instanceof CooLError) {
        throw new Error(`CooL Verification Error [${err.code}]: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * Creates a tampered copy of an evidence receipt for audit demonstration purposes.
   * Never mutates original evidence.
   */
  public createTamperedCopy(
    evidence: Evidence,
    tamperType: "metadata_hash" | "binding_hash" = "metadata_hash"
  ): {
    tamperedEvidence: Evidence;
    tamperedField: string;
    originalValue: string;
    tamperedValue: string;
    description: string;
  } {
    // Deep clone original evidence
    const copy: Evidence = JSON.parse(JSON.stringify(evidence));

    const recordAny = copy.record as any;
    if (tamperType === "metadata_hash" && recordAny?.event) {
      const originalValue = String(recordAny.event.metadata_hash);
      const tamperedValue = "mh:sha256:0000000000000000000000000000000000000000000000000000000000000000";
      recordAny.event.metadata_hash = tamperedValue;

      return {
        tamperedEvidence: copy,
        tamperedField: "record.event.metadata_hash",
        originalValue,
        tamperedValue,
        description:
          "Modified metadata_hash commitment in evidence core. Expected: binding and signature checks fail.",
      };
    } else {
      const originalValue = copy.binding_hash;
      const tamperedValue = "mh:sha256:0000000000000000000000000000000000000000000000000000000000000000";
      (copy as any).binding_hash = tamperedValue;

      return {
        tamperedEvidence: copy,
        tamperedField: "binding_hash",
        originalValue,
        tamperedValue,
        description:
          "Modified top-level binding_hash in evidence receipt. Expected: binding, signature, and inclusion checks fail.",
      };
    }
  }

  /**
   * Normalizes the CooL Verdict into a clean structured response for the API & frontend.
   */
  private normalizeVerdict(verdict: Verdict, formattedVerdict: string): NormalizedVerdict {
    return {
      valid: verdict.ok,
      schema: verdict.schema,
      subject: verdict.subject
        ? {
            kind: verdict.subject.kind,
            subject: verdict.subject.subject,
            issuedAt: verdict.subject.issued_at,
            recordId: verdict.subject.record_id,
            keyId: verdict.subject.key_id,
            tee: verdict.subject.tee,
          }
        : null,
      checks: {
        binding: {
          status: verdict.checks.binding.status,
          detail: verdict.checks.binding.detail,
        },
        signature: {
          status: verdict.checks.signature.status,
          detail: verdict.checks.signature.detail,
        },
        inclusion: {
          status: verdict.checks.inclusion.status,
          detail: verdict.checks.inclusion.detail,
        },
        witnesses: {
          status: verdict.checks.witnesses.status,
          detail: verdict.checks.witnesses.detail,
        },
        attestation: {
          status: verdict.checks.attestation.status,
          detail: verdict.checks.attestation.detail,
        },
        enclave: {
          status: verdict.checks.enclave.status,
          detail: verdict.checks.enclave.detail,
        },
        anchor: {
          status: verdict.checks.anchor.status,
          detail: verdict.checks.anchor.detail,
        },
      },
      reasons: verdict.reasons,
      formattedVerdict,
      attestationDisclaimer:
        "Local/default attestation is simulated under CooL simulator root. Hardware TEE (Intel TDX / Phala dstack) is not active in this environment.",
    };
  }
}

export const coolService = new CooLService();
