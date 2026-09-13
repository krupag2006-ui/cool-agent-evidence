import { CooL, verifyEvidence, formatVerdict } from "cool-nwc";

async function main() {
  console.log("=== STEP 1: INITIALIZE COOL SDK ===");
  const cool = new CooL({
    applicationId: "refund-agent",
  });
  console.log("CooL client created.");

  console.log("\n=== STEP 2: RECORD EVIDENCE ===");
  const recordResult = await cool.record({
    type: "agent.refund_approved",
    metadata: {
      agent: "RefundBot",
      version: "1.0.0",
      model: "Demo-Agent",
      policyVersion: "RefundPolicy-v1",
      decision: "REFUND_APPROVED",
      amount: 5000,
      reason: "product_damaged",
    },
    payloads: {
      input: JSON.stringify({ customerId: "CUST-101", orderId: "ORD-9902", claim: "Damaged packaging on arrival" }),
      output: JSON.stringify({ approved: true, payoutCents: 5000, authCode: "AUTH-88219" }),
    },
  });

  console.log("Record Result Keys:", Object.keys(recordResult));
  console.log("recordId:", recordResult.recordId);
  console.log("executionId:", recordResult.executionId);
  console.log("digest:", recordResult.digest);
  console.log("evidence schema:", recordResult.evidence.schema);

  console.log("\n=== STEP 3: VERIFY EVIDENCE ===");
  const verdict = await verifyEvidence(recordResult.evidence);
  console.log("Verdict OK:", verdict.ok);
  console.log("Verdict Subject:", verdict.subject);
  console.log("Verdict Checks:", JSON.stringify(verdict.checks, null, 2));
  console.log("Verdict Reasons:", verdict.reasons);
  console.log("\nFormatted Verdict:\n" + formatVerdict(verdict));

  console.log("\n=== STEP 4: TAMPER TEST ===");
  // Create a deep copy of the evidence and tamper with it
  const tampered = JSON.parse(JSON.stringify(recordResult.evidence));
  
  // Tampering with binding_hash or record payload
  console.log("Tampering with binding_hash...");
  tampered.binding_hash = "mh:sha256:0000000000000000000000000000000000000000000000000000000000000000";
  
  const tamperedVerdict = await verifyEvidence(tampered);
  console.log("Tampered Verdict OK:", tamperedVerdict.ok);
  console.log("Tampered Checks:", JSON.stringify(tamperedVerdict.checks, null, 2));
  console.log("Tampered Reasons:", tamperedVerdict.reasons);
  console.log("\nFormatted Tampered Verdict:\n" + formatVerdict(tamperedVerdict));

  console.log("\n=== STEP 5: TAMPER WITH METADATA HASH ===");
  const tampered2 = JSON.parse(JSON.stringify(recordResult.evidence));
  if (tampered2.record?.core?.event?.metadata_hash) {
    tampered2.record.core.event.metadata_hash = "mh:sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  }
  const tamperedVerdict2 = await verifyEvidence(tampered2);
  console.log("Tampered2 Verdict OK:", tamperedVerdict2.ok);
  console.log("Tampered2 Checks:", JSON.stringify(tamperedVerdict2.checks, null, 2));
  console.log("Tampered2 Reasons:", tamperedVerdict2.reasons);

  console.log("\nAll direct SDK tests completed successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

