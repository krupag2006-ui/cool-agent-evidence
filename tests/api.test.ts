import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { eventStore } from "../src/storage/eventStore.js";
import type { Server } from "node:http";

async function runTests() {
  console.log("====================================================");
  console.log("🧪 STARTING COO L EVIDENCE BACKEND TEST SUITE");
  console.log("====================================================");

  // Clear in-memory event store for pristine test execution
  eventStore.clear();

  const app = createApp();
  let server: Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[TEST SERVER] Running on ${baseUrl}`);
      resolve();
    });
  });

  try {
    // -----------------------------------------------------------------
    // TEST 1: GET /api/health
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 1: GET /api/health");
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200, "Health endpoint should return 200");
    const healthBody = await healthRes.json();
    console.log("  Health response:", healthBody);
    assert.equal(healthBody.status, "ok");
    assert.equal(healthBody.cool, "ready");
    assert.equal(healthBody.sdk, "cool-nwc");
    console.log("  ✔ Health endpoint passed");

    // -----------------------------------------------------------------
    // TEST 2: GET /api/events (empty list initially)
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 2: GET /api/events (empty initially)");
    const initialEventsRes = await fetch(`${baseUrl}/api/events`);
    assert.equal(initialEventsRes.status, 200);
    const initialEventsBody = await initialEventsRes.json();
    assert.equal(initialEventsBody.success, true);
    assert.equal(initialEventsBody.count, 0);
    console.log("  ✔ Initial events empty check passed");

    // -----------------------------------------------------------------
    // TEST 3: POST /api/record (valid refund event)
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 3: POST /api/record (Valid Refund Approval)");
    const recordPayload = {
      agent: "RefundBot",
      agentVersion: "1.0.0",
      model: "Demo-Agent",
      policyVersion: "RefundPolicy-v1",
      eventType: "agent.refund_approved",
      decision: "REFUND_APPROVED",
      amount: 5000,
      reason: "product_damaged",
      customerId: "CUST-9821",
      orderId: "ORD-54321",
    };

    const recordRes = await fetch(`${baseUrl}/api/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recordPayload),
    });

    assert.equal(recordRes.status, 201, "Record endpoint should return 201 Created");
    const recordBody = await recordRes.json();
    console.log("  Record response:", {
      success: recordBody.success,
      eventId: recordBody.eventId,
      recordId: recordBody.recordId,
      executionId: recordBody.executionId,
      digest: recordBody.digest,
      schema: recordBody.evidence?.schema,
    });

    assert.equal(recordBody.success, true);
    assert.ok(recordBody.eventId.startsWith("EVT-"), "Event ID should start with EVT-");
    assert.ok(recordBody.recordId, "Record ID should exist");
    assert.ok(recordBody.executionId, "Execution ID should exist");
    assert.ok(recordBody.digest.startsWith("mh:sha256:"), "Digest should be a valid multihash");
    assert.equal(recordBody.evidence.schema, "cool.receipt.v2", "Evidence schema should be cool.receipt.v2");
    assert.ok(recordBody.evidence.binding_hash, "Evidence must contain binding_hash");
    assert.ok(recordBody.evidence.record?.signature, "Evidence must contain cryptographic signature");
    console.log("  ✔ CooL record created with valid cryptographic structure");

    const createdEventId = recordBody.eventId;

    // -----------------------------------------------------------------
    // TEST 4: GET /api/events (should contain new event)
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 4: GET /api/events (Contains created event)");
    const eventsListRes = await fetch(`${baseUrl}/api/events`);
    const eventsListBody = await eventsListRes.json();
    assert.equal(eventsListBody.count, 1);
    assert.equal(eventsListBody.events[0].eventId, createdEventId);
    assert.equal(eventsListBody.events[0].agent, "RefundBot");
    assert.equal(eventsListBody.events[0].decision, "REFUND_APPROVED");
    assert.equal(eventsListBody.events[0].amount, 5000);
    console.log("  ✔ Event list verification passed");

    // -----------------------------------------------------------------
    // TEST 5: GET /api/events/:eventId
    // -----------------------------------------------------------------
    console.log(`\n▶ TEST 5: GET /api/events/${createdEventId}`);
    const eventDetailRes = await fetch(`${baseUrl}/api/events/${createdEventId}`);
    assert.equal(eventDetailRes.status, 200);
    const eventDetailBody = await eventDetailRes.json();
    assert.equal(eventDetailBody.event.eventId, createdEventId);
    assert.equal(eventDetailBody.event.evidence.schema, "cool.receipt.v2");
    console.log("  ✔ Event detail verification passed");

    // -----------------------------------------------------------------
    // TEST 6: POST /api/verify (Verify valid evidence)
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 6: POST /api/verify (Offline CooL Verification of Valid Evidence)");
    const verifyRes = await fetch(`${baseUrl}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: createdEventId }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    console.log("  Verification Verdict:", {
      valid: verifyBody.valid,
      recordId: verifyBody.recordId,
      checks: verifyBody.checks,
      reasons: verifyBody.reasons,
    });

    assert.equal(verifyBody.valid, true, "Valid evidence must verify as valid: true");
    assert.equal(verifyBody.checks.binding.status, "pass", "Binding check must PASS");
    assert.equal(verifyBody.checks.signature.status, "pass", "Signature check must PASS");
    assert.equal(verifyBody.checks.inclusion.status, "pass", "Inclusion check must PASS");
    assert.equal(verifyBody.checks.attestation.status, "simulated", "Attestation check is simulated");
    assert.equal(verifyBody.checks.enclave.status, "simulated", "Enclave check is simulated");
    assert.equal(verifyBody.reasons.length, 0, "Reasons should be empty for valid evidence");
    assert.ok(verifyBody.formattedVerdict.includes("RESULT      VERIFIED"));
    console.log("  ✔ Offline CooL verification succeeded with structured checks");

    // -----------------------------------------------------------------
    // TEST 7: POST /api/events/:eventId/tamper-demo
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 7: POST /api/events/:eventId/tamper-demo (Create Tampered Copy)");
    const tamperRes = await fetch(`${baseUrl}/api/events/${createdEventId}/tamper-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tamperType: "metadata_hash" }),
    });

    assert.equal(tamperRes.status, 200);
    const tamperBody = await tamperRes.json();
    console.log("  Tamper Demo created:", {
      tamperId: tamperBody.tamperId,
      originalEventId: tamperBody.originalEventId,
      tamperedField: tamperBody.tamperedField,
    });

    assert.ok(tamperBody.tamperId);
    assert.equal(tamperBody.originalEventId, createdEventId);
    assert.equal(tamperBody.tamperedField, "record.event.metadata_hash");
    assert.notEqual(tamperBody.originalValue, tamperBody.tamperedValue);

    const tamperId = tamperBody.tamperId;

    // Check that original event in storage was NOT modified
    const originalCheckRes = await fetch(`${baseUrl}/api/events/${createdEventId}`);
    const originalCheckBody = await originalCheckRes.json();
    assert.equal(
      originalCheckBody.event.evidence.record.event.metadata_hash,
      tamperBody.originalValue,
      "Original evidence must remain untouched"
    );
    console.log("  ✔ Tampered copy created safely without mutating original evidence");

    // -----------------------------------------------------------------
    // TEST 8: POST /api/verify-tampered
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 8: POST /api/verify-tampered (CooL Detects Tampering)");
    const verifyTamperedRes = await fetch(`${baseUrl}/api/verify-tampered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tamperId }),
    });

    assert.equal(verifyTamperedRes.status, 200);
    const verifyTamperedBody = await verifyTamperedRes.json();
    console.log("  Tampered Verdict:", {
      valid: verifyTamperedBody.valid,
      detectionConfirmed: verifyTamperedBody.detectionConfirmed,
      checks: {
        binding: verifyTamperedBody.checks.binding.status,
        signature: verifyTamperedBody.checks.signature.status,
      },
      reasons: verifyTamperedBody.reasons,
    });

    assert.equal(verifyTamperedBody.valid, false, "Tampered evidence MUST fail verification");
    assert.equal(verifyTamperedBody.detectionConfirmed, true);
    assert.equal(verifyTamperedBody.checks.binding.status, "fail", "Binding check must FAIL on tampered evidence");
    assert.equal(verifyTamperedBody.checks.signature.status, "fail", "Signature check must FAIL on tampered evidence");
    assert.ok(verifyTamperedBody.reasons.length > 0, "Reasons must detail the failures");
    assert.ok(verifyTamperedBody.formattedVerdict.includes("RESULT      FAILED"));

    // The isolated tampered copy must not invalidate the original receipt.
    const originalVerifyAfterTamperRes = await fetch(`${baseUrl}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: createdEventId }),
    });
    assert.equal(originalVerifyAfterTamperRes.status, 200);
    const originalVerifyAfterTamperBody = await originalVerifyAfterTamperRes.json();
    assert.equal(originalVerifyAfterTamperBody.valid, true);
    assert.equal(originalVerifyAfterTamperBody.checks.binding.status, "pass");
    assert.equal(originalVerifyAfterTamperBody.checks.signature.status, "pass");
    console.log("  ✔ CooL cryptographic engine detected tampering as expected!");

    // -----------------------------------------------------------------
    // TEST 9: POST /api/record validation failure (Invalid input)
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 9: POST /api/record (Validation Error Handling)");
    const invalidRecordRes = await fetch(`${baseUrl}/api/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Missing agent, decision, amount, reason
        amount: -50,
      }),
    });

    assert.equal(invalidRecordRes.status, 400);
    const invalidRecordBody = await invalidRecordRes.json();
    assert.equal(invalidRecordBody.success, false);
    assert.ok(invalidRecordBody.issues.length > 0);
    console.log("  ✔ Validation error handled cleanly with 400 Bad Request");

    // -----------------------------------------------------------------
    // TEST 10: Non-existent event 404
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 10: GET /api/events/EVT-NONEXISTENT (404 Handling)");
    const notFoundRes = await fetch(`${baseUrl}/api/events/EVT-NONEXISTENT`);
    assert.equal(notFoundRes.status, 404);
    console.log("  ✔ 404 Not Found handled cleanly");

    // -----------------------------------------------------------------
    // TEST 11: POST /api/refund (approved decision and CooL recording)
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 11: POST /api/refund (Approved RefundBot Decision)");
    const refundRes = await fetch(`${baseUrl}/api/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 5000,
        reason: "product_damaged",
        customerId: "CUST-REFUND-1",
        orderId: "ORD-REFUND-1",
      }),
    });

    assert.equal(refundRes.status, 201);
    const refundBody = await refundRes.json();
    assert.equal(refundBody.success, true);
    assert.equal(refundBody.decision.decision, "REFUND_APPROVED");
    assert.equal(refundBody.decision.agent, "RefundBot");
    assert.equal(refundBody.eventId.startsWith("EVT-"), true);
    assert.ok(refundBody.recordId);
    assert.ok(refundBody.digest.startsWith("mh:sha256:"));
    assert.equal(refundBody.evidence.schema, "cool.receipt.v2");
    assert.equal(refundBody.verification.valid, true);
    assert.equal(refundBody.evidenceStatus.decision, "REFUND_APPROVED");
    assert.equal(refundBody.evidenceStatus.evidence, "RECORDED");
    assert.equal(refundBody.evidenceStatus.verification, "VALID");
    assert.equal(refundBody.evidenceStatus.checks.binding.status, "pass");
    assert.equal(refundBody.evidenceStatus.checks.signature.status, "pass");
    const refundEventId = refundBody.eventId;
    console.log("  ✔ Approved decision recorded with real CooL evidence");

    // -----------------------------------------------------------------
    // TEST 12: POST /api/refund/:eventId/verify
    // -----------------------------------------------------------------
    console.log(`\n▶ TEST 12: POST /api/refund/${refundEventId}/verify`);
    const refundVerifyRes = await fetch(`${baseUrl}/api/refund/${refundEventId}/verify`, {
      method: "POST",
    });

    assert.equal(refundVerifyRes.status, 200);
    const refundVerifyBody = await refundVerifyRes.json();
    assert.equal(refundVerifyBody.success, true);
    assert.equal(refundVerifyBody.decision.decision, "REFUND_APPROVED");
    assert.equal(refundVerifyBody.eventId, refundEventId);
    assert.equal(refundVerifyBody.verification.valid, true);
    assert.equal(refundVerifyBody.verification.checks.binding.status, "pass");
    assert.equal(refundVerifyBody.verification.checks.signature.status, "pass");
    assert.equal(refundVerifyBody.evidenceStatus.verification, "VALID");
    assert.deepEqual(refundVerifyBody.evidenceStatus.checks, refundVerifyBody.verification.checks);
    console.log("  ✔ RefundBot evidence verified through the existing CooL verifier");

    // -----------------------------------------------------------------
    // TEST 13: POST /api/refund (rejected decision)
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 13: POST /api/refund (Rejected RefundBot Decision)");
    const rejectedRefundRes = await fetch(`${baseUrl}/api/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 15000,
        reason: "customer_changed_mind",
        customerId: "CUST-REFUND-2",
        orderId: "ORD-REFUND-2",
      }),
    });

    assert.equal(rejectedRefundRes.status, 201);
    const rejectedRefundBody = await rejectedRefundRes.json();
    assert.equal(rejectedRefundBody.decision.decision, "REFUND_REJECTED");
    assert.equal(rejectedRefundBody.decision.eventType, "agent.refund_rejected");
    assert.equal(rejectedRefundBody.evidence.schema, "cool.receipt.v2");
    assert.equal(rejectedRefundBody.verification.valid, true);
    assert.equal(rejectedRefundBody.evidenceStatus.decision, "REFUND_REJECTED");
    assert.equal(rejectedRefundBody.evidenceStatus.verification, "VALID");
    console.log("  ✔ Rejected decision was recorded deterministically");

    // -----------------------------------------------------------------
    // TEST 14: POST /api/refund validation failure
    // -----------------------------------------------------------------
    console.log("\n▶ TEST 14: POST /api/refund (Validation Error Handling)");
    const invalidRefundRes = await fetch(`${baseUrl}/api/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: -1, reason: "product_damaged" }),
    });

    assert.equal(invalidRefundRes.status, 400);
    const invalidRefundBody = await invalidRefundRes.json();
    assert.equal(invalidRefundBody.success, false);
    assert.ok(invalidRefundBody.issues.length >= 2);
    console.log("  ✔ RefundBot input validation returned 400");

    console.log("\n====================================================");
    console.log("🎉 ALL 14 TESTS PASSED SUCCESSFULLY!");
    console.log("====================================================");
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error("\n❌ Test suite failed with error:", err);
  process.exit(1);
});

