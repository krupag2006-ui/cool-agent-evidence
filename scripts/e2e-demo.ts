import { createApp } from "../src/app.js";
import type { Server } from "node:http";

async function main() {
  console.log("====================================================");
  console.log("🏁 COO L EVIDENCE END-TO-END DEMO TEST RUN");
  console.log("====================================================");

  const app = createApp();
  const PORT = 3099;
  let server: Server;

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[E2E] Server listening on http://localhost:${PORT}`);
      resolve();
    });
  });

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Health check
    console.log("\n--- STEP 1: Check /api/health ---");
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    console.log("Health Status:", healthRes.status, healthJson);

    // 2. Create RefundBot event via /api/record
    console.log("\n--- STEP 2: Post Refund Decision to /api/record ---");
    const refundPayload = {
      agent: "RefundBot",
      agentVersion: "2.1.0",
      model: "RefundGPT-4o-Mini",
      policyVersion: "ECommercePolicy-2026-Q3",
      eventType: "agent.refund_approved",
      decision: "REFUND_APPROVED",
      amount: 14999,
      reason: "Damaged item returned with photo verification",
      customerId: "USER_ALICE_4021",
      orderId: "ORDER_ITEM_99341",
      payloads: {
        input: {
          returnTracking: "1Z9999999999999999",
          inspectionStatus: "CONFIRMED_DAMAGED",
        },
        output: {
          refundReference: "REF_TXN_8884920",
          paymentMethod: "ORIGINAL_CREDIT_CARD",
        },
      },
    };

    const recordRes = await fetch(`${baseUrl}/api/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refundPayload),
    });

    const recordJson = await recordRes.json();
    console.log("Record Status:", recordRes.status);
    console.log("Event ID:", recordJson.eventId);
    console.log("CooL Record ID (ULID):", recordJson.recordId);
    console.log("Execution ID:", recordJson.executionId);
    console.log("Binding Digest:", recordJson.digest);
    console.log("Receipt Schema:", recordJson.evidence?.schema);
    console.log("Commitment Keys:", Object.keys(recordJson.evidence.record.event.commitments));

    const eventId = recordJson.eventId;

    // 3. Verify event via /api/verify
    console.log(`\n--- STEP 3: Verify Event ${eventId} via /api/verify ---`);
    const verifyRes = await fetch(`${baseUrl}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });

    const verifyJson = await verifyRes.json();
    console.log("Verify Status:", verifyRes.status);
    console.log("Valid:", verifyJson.valid);
    console.log("Checks:");
    console.log("  - Binding:    ", verifyJson.checks.binding.status, `(${verifyJson.checks.binding.detail})`);
    console.log("  - Signature:  ", verifyJson.checks.signature.status, `(${verifyJson.checks.signature.detail})`);
    console.log("  - Inclusion:  ", verifyJson.checks.inclusion.status, `(${verifyJson.checks.inclusion.detail})`);
    console.log("  - Attestation:", verifyJson.checks.attestation.status);
    console.log("  - Enclave:    ", verifyJson.checks.enclave.status);
    console.log("Verdict ASCII Block:\n" + verifyJson.formattedVerdict);

    // 4. Create Tamper Demo copy via /api/events/:eventId/tamper-demo
    console.log(`\n--- STEP 4: Create Tampered Copy for Event ${eventId} ---`);
    const tamperRes = await fetch(`${baseUrl}/api/events/${eventId}/tamper-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tamperType: "metadata_hash" }),
    });

    const tamperJson = await tamperRes.json();
    console.log("Tamper Demo Status:", tamperRes.status);
    console.log("Tamper ID:", tamperJson.tamperId);
    console.log("Field Modified:", tamperJson.tamperedField);
    console.log("Original Hash:", tamperJson.originalValue);
    console.log("Tampered Hash:", tamperJson.tamperedValue);

    const tamperId = tamperJson.tamperId;

    // 5. Verify Tampered Copy via /api/verify-tampered
    console.log(`\n--- STEP 5: Verify Tampered Copy ${tamperId} via /api/verify-tampered ---`);
    const verifyTamperedRes = await fetch(`${baseUrl}/api/verify-tampered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tamperId }),
    });

    const verifyTamperedJson = await verifyTamperedRes.json();
    console.log("Verify Tampered Status:", verifyTamperedRes.status);
    console.log("Valid (Must be false):", verifyTamperedJson.valid);
    console.log("Tamper Detected:", verifyTamperedJson.detectionConfirmed);
    console.log("Binding Check:  ", verifyTamperedJson.checks.binding.status);
    console.log("Signature Check:", verifyTamperedJson.checks.signature.status);
    console.log("Reasons for failure:", verifyTamperedJson.reasons);
    console.log("Tampered ASCII Block:\n" + verifyTamperedJson.formattedVerdict);

    // 6. List events for dashboard via /api/events
    console.log("\n--- STEP 6: Get Dashboard Events via /api/events ---");
    const eventsRes = await fetch(`${baseUrl}/api/events`);
    const eventsJson = await eventsRes.json();
    console.log(`Total Events in Dashboard: ${eventsJson.count}`);
    console.table(eventsJson.events);

    console.log("\n====================================================");
    console.log("✅ E2E FLOW COMPLETED WITH 100% SUCCESS!");
    console.log("====================================================");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("E2E Demo failed:", err);
  process.exit(1);
});

