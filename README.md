# CooL Evidence

> Tamper-evident, cryptographically verifiable evidence receipts for consequential AI agent decisions.

[![CooL SDK](https://img.shields.io/badge/CooL%20SDK-cool--nwc%203.0.0-blue.svg)](https://github.com/Northwind-Cipher/cool-sdk)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-lightgrey.svg)](LICENSE)

---

## The Problem

Autonomous AI agents increasingly make consequential real-world decisions: approving financial refunds, validating insurance claims, adjusting credit lines, and executing sensitive trades. 

When disputes or regulatory audits occur weeks or months later, organizations must answer critical questions:
- **What exact code, model, and policy version ran?**
- **What inputs led to this decision?**
- **Was the audit trail modified or deleted after the fact?**
- **Can an external third party verify the proof without trusting our internal database?**

Traditional solutions rely on ordinary application logs stored in centralized databases (PostgreSQL, Elasticsearch, CloudWatch). These logs have severe limitations:
1. **Malleability**: Anyone with database access or cloud admin credentials can alter or delete rows.
2. **Implicit Trust**: Auditors must unconditionally trust the company hosting the logs.
3. **Lack of Cryptographic Lineage**: Standard logs do not cryptographically bind software identity, policy versions, and execution records.

---

## The Solution: CooL Evidence

**CooL Evidence** integrates the official [CooL SDK (`cool-nwc`)](https://github.com/Northwind-Cipher/cool-sdk) into an AI Agent workflow (demonstrated via an AI Refund Agent).

Instead of storing unverified text logs, the agent generates a **self-contained, cryptographically sealed evidence receipt** for every decision. The receipt binds the agent's identity, policy version, and salted payload commitments using:
- **Post-Quantum Hybrid Signatures**: ML-DSA-65 (NIST FIPS 204) + Ed25519.
- **RFC 6962 Transparency Log**: Merkle tree inclusion proofs with signed tree heads.
- **Offline Independent Verification**: Anyone holding the receipt can verify it anywhere without network access or database credentials.

---

## Architecture Flow

```
[ User Claim / Input ]
         │
         ▼
[ AI Refund Agent ] (Evaluates policy, amount, reasons)
         │
         ▼
[ CooL SDK Client ] (cool-nwc)
         │
         ├── Commitments: SHA-256 salted hashes of metadata & payloads
         ├── Hybrid Signature: ML-DSA-65 + Ed25519
         └── Merkle Log: RFC 6962 inclusion proof & STH
         │
         ▼
[ Evidence Receipt (cool.receipt.v2) ]
         │
         ├── Stored in Event Store (data/events.json)
         └── Returned to Client / Auditor
         │
         ▼
[ CooL Verifier ] (verifyEvidence offline)
         │
         ▼
[ Structured Verdict: 7 Domains (Binding, Signature, Inclusion...) ]
```

---

## Why CooL Matters

| Capability | Standard Application Logging | With CooL Evidence |
|---|---|---|
| **Tamper Resistance** | ❌ None (DB rows can be edited) | ✅ Cryptographically sealed; any bit flip fails signature & binding |
| **Trust Model** | ❌ Trust the cloud operator | ✅ Zero-trust; self-contained receipt verified offline |
| **Data Privacy** | ⚠️ Plaintext logs leak PII | ✅ Salted hash commitments; plaintext discarded from receipt |
| **Auditability** | ❌ Internal log export only | ✅ Portable JSON receipts verifiable by any independent auditor |
| **Quantum Resistance** | ❌ None | ✅ Hybrid ML-DSA-65 post-quantum cryptography |
| **Transparency Log** | ❌ None | ✅ RFC 6962 append-only Merkle tree inclusion proofs |

---

## Actual CooL SDK Integration

This repository uses the real, official `cool-nwc` package without mock implementations or custom cryptography:

```typescript
import { CooL, verifyEvidence, formatVerdict } from "cool-nwc";

// 1. Initialize client once
const cool = new CooL({
  applicationId: "refund-agent"
});

// 2. Record an agent decision
const recordResult = await cool.record({
  type: "agent.refund_approved",
  metadata: {
    agent: "RefundBot",
    version: "1.0.0",
    model: "Demo-Agent",
    policyVersion: "RefundPolicy-v1",
    decision: "REFUND_APPROVED",
    amount: 5000,
    reason: "product_damaged"
  },
  payloads: {
    input: JSON.stringify({ customerId: "CUST-9821", orderId: "ORD-54321" }),
    output: JSON.stringify({ approved: true, payoutCents: 5000 })
  }
});

// recordResult contains:
// - recordResult.recordId (ULID)
// - recordResult.executionId (UUID/ULID)
// - recordResult.digest (Multihash SHA-256)
// - recordResult.evidence (Self-contained ReceiptV2 envelope)

// 3. Verify offline
const verdict = await verifyEvidence(recordResult.evidence);

console.log(verdict.ok); // true
console.log(formatVerdict(verdict)); // ASCII verification block
```

---

## Cryptographic Privacy & Security

In compliance with CooL's architecture:
- Sensitive inputs and outputs are never stored as plaintext in the evidence receipt.
- Each payload is committed as a salted multihash: `mh:sha256(salt || bytes)`.
- Salts are retained alongside the commitment so that an authorized auditor can later reveal the original document and mathematically prove it matches the receipt.
- Private signing keys are managed inside the CooL runtime enclave/simulator and are never exposed to application logs or client responses.

---

## Structured Verification Domains

Verification produces a structured verdict across **7 independent trust domains**, never a bare boolean:

1. **`binding`**: Recomputes the canonical hash of the record core and asserts exact match with `binding_hash`.
2. **`signature`**: Validates the hybrid post-quantum **ML-DSA-65** and **Ed25519** signatures over the record.
3. **`inclusion`**: Validates the Merkle audit path reconstructing the Signed Tree Head (STH) root according to RFC 6962.
4. **`witnesses`**: Checks independent witness co-signatures (marked `absent` when running in single-node demo mode).
5. **`attestation`**: Evaluates hardware quote authenticity (reports `simulated` in standard Node.js runtime).
6. **`enclave`**: Evaluates whether signing keys were sealed to an approved enclave measurement.
7. **`anchor`**: Checks public blockchain timestamping (e.g. Bitcoin OpenTimestamps).

> [!IMPORTANT]
> **Simulated Attestation Notice**:
> In local and cloud node environments without physical Confidential Computing hardware (Intel TDX or Phala dstack), the CooL SDK uses its built-in simulator root. The verifier accurately labels attestation and enclave checks as **`simulated`**. This prototype honestly reports simulated attestation and does **not** claim hardware-backed guarantees.

---

## API Summary

Detailed endpoint documentation and schemas are available in [docs/API.md](docs/API.md).

- `GET  /api/health` — Service readiness and SDK status.
- `POST /api/record` — Records agent decision, stores event, returns CooL receipt.
- `POST /api/verify` — Verifies stored receipt offline with CooL verifier.
- `GET  /api/events` — Lists recent recorded decisions for frontend dashboard.
- `GET  /api/events/:eventId` — Fetches full event details and complete evidence receipt.
- `POST /api/events/:eventId/tamper-demo` — Creates safe, isolated tampered copy for demo.
- `POST /api/verify-tampered` — Verifies tampered copy and demonstrates cryptographic rejection.

---

## Getting Started

### Prerequisites
- Node.js `>= 20.0.0`
- npm `>= 10.0.0`

### Installation
```bash
git clone <repo-url>
cd cool-evidence
npm install
```

### Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```env
PORT=3001
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000,http://localhost:5173
COOL_APPLICATION_ID=refund-agent
```

### Running the Server
```bash
# Development (with live-reload via tsx)
npm run dev

# Production build and run
npm run build
npm start
```

### Running Tests
```bash
# Run full automated test suite (10 test cases covering all endpoints)
npm test

# Run direct CooL SDK verification spike
npm run test:cool
```

---

## Demonstration: Detecting Tampered Receipts

To demonstrate CooL's tamper-evident guarantees during an audit presentation:

1. **Record an event**:
   ```bash
   curl -X POST http://localhost:3001/api/record \
     -H "Content-Type: application/json" \
     -d '{"agent":"RefundBot","decision":"REFUND_APPROVED","amount":5000,"reason":"damaged_goods"}'
   ```
2. **Verify valid receipt**:
   ```bash
   curl -X POST http://localhost:3001/api/verify \
     -H "Content-Type: application/json" \
     -d '{"eventId":"EVT-001"}'
   # Result: valid: true, binding: pass, signature: pass, inclusion: pass
   ```
3. **Generate isolated tampered copy**:
   ```bash
   curl -X POST http://localhost:3001/api/events/EVT-001/tamper-demo
   # Returns: tamperId (e.g. "tamper_c1c779a1123e")
   ```
4. **Verify tampered copy**:
   ```bash
   curl -X POST http://localhost:3001/api/verify-tampered \
     -H "Content-Type: application/json" \
     -d '{"tamperId":"tamper_c1c779a1123e"}'
   # Result: valid: false, binding: fail, signature: fail, detectionConfirmed: true
   ```

