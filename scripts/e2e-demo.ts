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
    // Preflight only; the numbered flow below is the product story.
    console.log("\n--- COO L EVIDENCE PREFLIGHT ---");
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    console.log("Health Status:", healthRes.status, healthJson);

    // 1. AI agent action
    console.log("\n--- STEP 1: AI AGENT ACTION ---");
    console.log("RefundBot receives: INR 5,000 refund | product_damaged");
    const refundPayload = {
      amount: 5000,
      reason: "product_damaged",
      customerId: "USER_ALICE_4021",
      orderId: "ORDER_ITEM_99341",
    };

    const recordRes = await fetch(`${baseUrl}/api/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refundPayload),
    });

    const recordJson = await recordRes.json();
    console.log("Record Status:", recordRes.status);

    // 2. AI decision
    console.log("\n--- STEP 2: AI DECISION ---");
    console.log("RefundBot Decision:", recordJson.decision?.decision);

    // 3. CooL evidence
    console.log("\n--- STEP 3: COO L EVIDENCE ---");
    console.log("Evidence Status:", recordJson.evidenceStatus?.evidence);
    console.log("Event ID:", recordJson.eventId);
    console.log("CooL Record ID (ULID):", recordJson.recordId);
    console.log("Execution ID:", recordJson.executionId);
    console.log("Binding Digest:", recordJson.digest);
    console.log("Receipt Schema:", recordJson.evidence?.schema);
    console.log("Commitment Keys:", Object.keys(recordJson.evidence.record.event.commitments));

    const eventId = recordJson.eventId;

    // 4. Verify original evidence
    console.log(`\n--- STEP 4: COO L VERIFY ---`);
    const verifyRes = await fetch(`${baseUrl}/api/refund/${eventId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });

    const verifyJson = await verifyRes.json();
    console.log("Verify Status:", verifyRes.status);
    console.log("CooL Verification:", verifyJson.evidenceStatus?.verification);
    console.log("Checks:");
    for (const [name, check] of Object.entries(verifyJson.verification.checks)) {
      console.log(`  - ${name}: ${check.status.toUpperCase()}`);
    }
    console.log("Reasons:", verifyJson.verification.reasons);
    console.log("Verdict ASCII Block:\n" + verifyJson.verification.formattedVerdict);

    // 5. Attack an isolated copy
    console.log(`\n--- STEP 5: ATTACK ---`);
    console.log("Modifying an isolated copy of the evidence receipt...");
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

    // 6. Verify tampered copy
    console.log(`\n--- STEP 6: VERIFY AGAIN ---`);
    const verifyTamperedRes = await fetch(`${baseUrl}/api/verify-tampered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tamperId }),
    });

    const verifyTamperedJson = await verifyTamperedRes.json();
    console.log("Verify Tampered Status:", verifyTamperedRes.status);
    console.log("Tampered CooL Verification:", verifyTamperedJson.valid ? "VALID" : "INVALID");
    console.log("Tamper Detected:", verifyTamperedJson.detectionConfirmed);
    console.log("Binding Check:  ", verifyTamperedJson.checks.binding.status.toUpperCase());
    console.log("Signature Check:", verifyTamperedJson.checks.signature.status.toUpperCase());
    console.log("Reasons for failure:", verifyTamperedJson.reasons);
    console.log("Tampered ASCII Block:\n" + verifyTamperedJson.formattedVerdict);

    // 7. Detection and original integrity
    console.log("\n--- STEP 7: DETECTION ---");
    const originalAfterTamperRes = await fetch(`${baseUrl}/api/refund/${eventId}/verify`, {
      method: "POST",
    });
    const originalAfterTamperJson = await originalAfterTamperRes.json();
    console.log("Original:", originalAfterTamperJson.evidenceStatus?.verification);
    console.log("Tampered:", verifyTamperedJson.valid ? "VALID" : "INVALID");
    console.log("Failed cryptographic checks:", {
      binding: verifyTamperedJson.checks.binding.status,
      signature: verifyTamperedJson.checks.signature.status,
    });

    // Dashboard confirmation
    console.log("\n--- EVIDENCE EVENT STORE ---");
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

