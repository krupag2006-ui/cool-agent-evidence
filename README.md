# CooL Evidence

> Tamper-evident, cryptographically verifiable evidence receipts for consequential AI agent decisions.

[![CooL SDK](https://img.shields.io/badge/CooL%20SDK-cool--nwc%203.0.0-blue.svg)](https://github.com/Northwind-Cipher/cool-sdk)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-lightgrey.svg)](LICENSE)



> Cryptographic evidence for every AI-agent action.

## 🚀 Live Demo

**[Try CooL Evidence →](https://cool-evidence.vercel.app/)**

CooL Evidence is a cryptographic evidence layer for AI agents that
turns consequential decisions into independently verifiable receipts.
## The Problem

Autonomous AI agents increasingly make consequential real-world decisions: approving financial refunds, validating insurance claims, adjusting credit lines, and executing sensitive trades. 

When disputes or regulatory audits occur weeks or months later, organizations must answer critical questions:

Traditional solutions rely on ordinary application logs stored in centralized databases (PostgreSQL, Elasticsearch, CloudWatch). These logs have severe limitations:
1. **Malleability**: Anyone with database access or cloud admin credentials can alter or delete rows.
2. **Implicit Trust**: Auditors must unconditionally trust the company hosting the logs.
3. **Lack of Cryptographic Lineage**: Standard logs do not cryptographically bind software identity, policy versions, and execution records.


## The Solution: CooL Evidence

**CooL Evidence** integrates the official [CooL SDK (`cool-nwc`)](https://github.com/Northwind-Cipher/cool-sdk) into an AI Agent workflow (demonstrated via an AI Refund Agent).

Instead of storing unverified text logs, the agent generates a **self-contained, cryptographically sealed evidence receipt** for every decision. The receipt binds the agent's identity, policy version, and salted payload commitments using:
- **Post-Quantum Hybrid Signatures**: ML-DSA-65 + Ed25519.
- **RFC 6962 Transparency Log**: Merkle inclusion proofs with signed tree heads.
- **Offline Verification**: A receipt can be checked independently of the event store.

## How The Product Works

1. RefundBot evaluates a request using deterministic `RefundPolicy-v1` rules.
2. The decision goes through `coolService.recordDecision()` and the real `cool-nwc` SDK.
3. CooL returns a `cool.receipt.v2` receipt with an event ID, record ID, execution ID, digest, and evidence.
4. The receipt is stored and checked with `coolService.verify()`.
5. The verifier returns actual binding, signature, inclusion, witnesses, attestation, enclave, and anchor statuses.
6. The tamper demo verifies an isolated modified copy; the original receipt remains unchanged and valid.


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


## Why CooL Matters

| Capability | Standard Application Logging | With CooL Evidence |
|---|---|---|
| **Tamper Resistance** | ❌ None (DB rows can be edited) | ✅ Cryptographically sealed; any bit flip fails signature & binding |
| **Trust Model** | ❌ Trust the cloud operator | ✅ Zero-trust; self-contained receipt verified offline |
| **Data Privacy** | ⚠️ Plaintext logs leak PII | ✅ Salted hash commitments; plaintext discarded from receipt |
| **Auditability** | ❌ Internal log export only | ✅ Portable JSON receipts verifiable by any independent auditor |
| **Quantum Resistance** | ❌ None | ✅ Hybrid ML-DSA-65 post-quantum cryptography |
| **Transparency Log** | ❌ None | ✅ RFC 6962 append-only Merkle tree inclusion proofs |


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


## Cryptographic Privacy & Security

In compliance with CooL's architecture:
- Sensitive payloads are represented in the receipt through salted commitments.
- Private signing keys remain inside the CooL runtime and are not returned by the API.


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


## API Summary

Detailed endpoint documentation and schemas are available in [docs/API.md](docs/API.md).

- `GET /api/health` - Service readiness and SDK status.
- `POST /api/refund` - Evaluate and record a deterministic RefundBot decision.
- `POST /api/refund/:eventId/verify` - Verify a recorded RefundBot event.
- `POST /api/record` - Record a general agent decision through CooL.
- `POST /api/verify` - Verify a stored receipt offline.
- `GET /api/events` and `GET /api/events/:eventId` - List or inspect events.
- `POST /api/events/:eventId/tamper-demo` - Create an isolated tampered copy.
- `POST /api/verify-tampered` - Verify the tampered copy with CooL.


## Getting Started

### Prerequisites
- Node.js `>=20.0.0`
- npm `>=10.0.0`

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
# Run the automated API and CooL evidence test suite
npm test

# Run direct CooL SDK verification spike
npm run test:cool
```

## Technologies Used

- Node.js and strict TypeScript
- Express and Zod validation
- Official `cool-nwc` 3.x SDK
- JSON event store for the local prototype
- `tsx` for development, tests, and the E2E demo

## Technical Decisions

- RefundBot is deterministic and explainable; it does not call an external LLM or API.
- CooL recording and verification remain owned by the existing `coolService`.
- Rejected decisions are recorded for auditability.
- Tampering always uses a deep-copied receipt and never mutates the original event.
- Frontends must use CooL verification results, not infer trust from the RefundBot decision.

## Limitations

This prototype is intentionally small and transparent about its production boundary:

- JSON file storage in `data/events.json` should be replaced with durable database and object storage in production.
- Local Node.js runs report `attestation: simulated` and `enclave: simulated` using the CooL simulator root; hardware-backed Intel TDX or Phala dstack requires real TEE configuration.
- RefundBot currently uses deterministic `RefundPolicy-v1` demo rules rather than an external LLM.
- Production deployment could add durable persistence, hardware-backed attestation, real witness nodes, and public anchoring.

Witnesses and public anchoring may also report `absent` in the local demo.

## Future Improvements

- Add durable production storage and retention controls.
- Configure real witness nodes and public anchoring.
- Run in a hardware-backed confidential-computing environment.
- Add other consequential agent workflows on the same CooL evidence layer.


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

