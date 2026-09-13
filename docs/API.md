# CooL Evidence API Contract

Backend REST API documentation for **Member 1 (Frontend Developer)** and **Member 3 (RefundBot Integration)**.

Base URL: `http://localhost:3001` (configurable via `PORT` environment variable)

All request bodies and responses are standard JSON with `Content-Type: application/json`.

---

## Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health and CooL SDK readiness |
| `POST` | `/api/record` | Record agent decision with CooL cryptographic evidence |
| `POST` | `/api/verify` | Verify stored evidence receipt offline using CooL verifier |
| `GET` | `/api/events` | List recorded events (for dashboard) |
| `GET` | `/api/events/:eventId` | Get full event details, metadata, and evidence receipt |
| `POST` | `/api/events/:eventId/tamper-demo` | Safely create an isolated tampered copy for demo |
| `POST` | `/api/verify-tampered` | Verify a tampered copy to demonstrate cryptographic rejection |

---

## 1. GET `/api/health`

Checks server health and verifies that the CooL SDK client is initialized and ready.

### Request
No parameters or body required.

### Response `200 OK`
```json
{
  "status": "ok",
  "cool": "ready",
  "sdk": "cool-nwc",
  "sdkVersion": "3.0.0",
  "attestation": "simulated (local node runtime)",
  "timestamp": "2026-09-13T09:44:47.940Z"
}
```

---

## 2. POST `/api/record`

Records an AI agent decision (such as a refund authorization) through the CooL SDK. CooL generates an immutable evidence receipt committing to the metadata and payloads using salted SHA-256 hashes and ML-DSA-65 + Ed25519 hybrid signatures.

### Request Body
```json
{
  "agent": "RefundBot",
  "agentVersion": "1.0.0",
  "model": "Demo-Agent",
  "policyVersion": "RefundPolicy-v1",
  "eventType": "agent.refund_approved",
  "decision": "REFUND_APPROVED",
  "amount": 5000,
  "reason": "product_damaged",
  "customerId": "CUST-9821",
  "orderId": "ORD-54321",
  "payloads": {
    "input": { "claim": "Damaged screen on arrival" },
    "output": { "approved": true, "payoutCents": 5000 }
  }
}
```

#### Field Specifications:
| Field | Type | Required | Description |
|---|---|---|---|
| `agent` | string | **Yes** | Name of the executing AI agent (e.g. `"RefundBot"`) |
| `decision` | string | **Yes** | Decision result (e.g. `"REFUND_APPROVED"`, `"REFUND_REJECTED"`) |
| `amount` | number | **Yes** | Transaction or refund amount (non-negative) |
| `reason` | string | **Yes** | Reason code or justification text |
| `agentVersion` | string | No | Version of the agent (default: `"1.0.0"`) |
| `model` | string | No | Underlying model used (default: `"Demo-Agent"`) |
| `policyVersion`| string | No | Governance policy version (default: `"RefundPolicy-v1"`) |
| `eventType` | string | No | Event type identifier (default: `"agent.refund_approved"`) |
| `customerId` | string | No | Optional customer ID |
| `orderId` | string | No | Optional order ID |
| `payloads` | object | No | Raw input/output to commit via salted hash |

### Response `201 Created`
```json
{
  "success": true,
  "eventId": "EVT-001",
  "recordId": "01M2D2FCYBS7HBS69AGG6KXMYK",
  "executionId": "01M2D2FCY5KWNJXKDBC31DDJC5",
  "digest": "mh:sha256:1af32ff6f6f5380d714a1dd6df6a30eab588e2794151581ea0c8ebbff89b521f",
  "timestamp": "2026-09-13T09:44:48.000Z",
  "status": "recorded",
  "evidence": {
    "schema": "cool.receipt.v2",
    "record": {
      "schema": "cool.evidence.v1",
      "record_id": "01M2D2FCYBS7HBS69AGG6KXMYK",
      "time": { ... },
      "event": {
        "type": "agent.refund_approved",
        "application_id": "refund-agent",
        "execution_id": "01M2D2FCY5KWNJXKDBC31DDJC5",
        "metadata_hash": "mh:sha256:...",
        "metadata_salt": "...",
        "commitments": { ... }
      },
      "runtime": { ... },
      "signature": { ... }
    },
    "binding_hash": "mh:sha256:...",
    "inclusion": { ... },
    "sth": { ... },
    "attestation": { ... },
    "anchor": null,
    "key_directory": { ... }
  }
}
```

### Error Responses
- `400 Bad Request`: Input validation failure (missing required fields or negative amount).
```json
{
  "success": false,
  "error": "Validation failed",
  "issues": [{ "field": "amount", "message": "Amount must be a non-negative number" }]
}
```
- `500 Internal Server Error`: CooL SDK error or storage write failure.

---

## 3. POST `/api/verify`

Verifies an evidence receipt offline using the official CooL SDK verifier (`verifyEvidence`). Returns a structured verdict across all 7 verification domains.

### Request Body
Verify by `eventId` (recommended):
```json
{
  "eventId": "EVT-001"
}
```
*Or verify directly with a raw receipt:*
```json
{
  "evidence": { ... }
}
```

### Response `200 OK`
```json
{
  "success": true,
  "valid": true,
  "eventId": "EVT-001",
  "recordId": "01M2D2FCYBS7HBS69AGG6KXMYK",
  "subject": {
    "kind": "evidence",
    "subject": "agent.refund_approved (refund-agent)",
    "issuedAt": "2026-09-13T09:44:48.000Z",
    "recordId": "01M2D2FCYBS7HBS69AGG6KXMYK",
    "keyId": "cool-enclave-e44bc35f5f",
    "tee": "intel-tdx · simulated"
  },
  "checks": {
    "binding": {
      "status": "pass",
      "detail": "recomputed from record, matches"
    },
    "signature": {
      "status": "pass",
      "detail": "ML-DSA-65 + Ed25519 valid (key cool-enclave-e44bc35f5f)"
    },
    "inclusion": {
      "status": "pass",
      "detail": "leaf 0 ∈ tree(1); STH signature valid"
    },
    "witnesses": {
      "status": "absent",
      "detail": "0 independent (1 self-signature, not counted)"
    },
    "attestation": {
      "status": "simulated",
      "detail": "simulated quote signature valid under the CooL simulator root (NOT a vendor root) — this is NOT evidence that any hardware protected the run"
    },
    "enclave": {
      "status": "simulated",
      "detail": "quote is inside the signature; measurement e44bc35f5fd7… holds the signing key; no measurement pinned by the verifier — but the quote itself is simulated"
    },
    "anchor": {
      "status": "absent",
      "detail": "NONE — this head was never submitted to a public chain"
    }
  },
  "reasons": [],
  "formattedVerdict": "+----------------------------------------------------------+\n| COOL VERIFIER                                            |\n+----------------------------------------------------------+\n| subject     agent.refund_approved (refund-agent)         |\n| record id   01M2D2FCYBS7HBS69AGG6KXMYK                   |\n| signer      cool-enclave-e44bc35f5f                      |\n| runtime     intel-tdx · simulated                        |\n|                                                          |\n| OK  binding      valid                                   |\n| OK  signature    valid                                   |\n| OK  inclusion    valid                                   |\n| -   witnesses    absent                                  |\n| ~   attestation  simulated                               |\n| ~   enclave      simulated                               |\n| -   anchor       absent                                  |\n+----------------------------------------------------------+\n| RESULT      VERIFIED                                     |\n+----------------------------------------------------------+",
  "attestationDisclaimer": "Local/default attestation is simulated under CooL simulator root. Hardware TEE (Intel TDX / Phala dstack) is not active in this environment."
}
```

### Understanding the 7 Domains in the Frontend:
1. `binding`: **Pass** confirms canonical record hash matches the binding hash.
2. `signature`: **Pass** confirms hybrid post-quantum ML-DSA-65 + Ed25519 signature is authentic.
3. `inclusion`: **Pass** confirms entry is cryptographically included in the RFC 6962 transparency log tree.
4. `witnesses`: **Absent** (expected in single-node demo mode without external witness nodes).
5. `attestation`: **Simulated** (expected in local/node environment without physical Intel TDX / Phala dstack TEE hardware).
6. `enclave`: **Simulated** (quote is validated against simulator root).
7. `anchor`: **Absent** (Bitcoin public calendar anchoring is in flight or unconfigured for local demo).

---

## 4. GET `/api/events`

Returns list of all recorded events for the frontend dashboard table or activity feed.

### Request
No parameters required.

### Response `200 OK`
```json
{
  "success": true,
  "count": 1,
  "events": [
    {
      "eventId": "EVT-001",
      "agent": "RefundBot",
      "decision": "REFUND_APPROVED",
      "amount": 5000,
      "reason": "product_damaged",
      "timestamp": "2026-09-13T09:44:48.000Z",
      "recordId": "01M2D2FCYBS7HBS69AGG6KXMYK",
      "executionId": "01M2D2FCY5KWNJXKDBC31DDJC5",
      "status": "verified",
      "digest": "mh:sha256:1af32ff6f6f5380d714a1dd6df6a30eab588e2794151581ea0c8ebbff89b521f"
    }
  ]
}
```

---

## 5. GET `/api/events/:eventId`

Returns complete event details and full cryptographic evidence receipt.

### Request Parameters
`eventId`: e.g. `EVT-001`

### Response `200 OK`
```json
{
  "success": true,
  "event": {
    "eventId": "EVT-001",
    "recordId": "01M2D2FCYBS7HBS69AGG6KXMYK",
    "executionId": "01M2D2FCY5KWNJXKDBC31DDJC5",
    "digest": "mh:sha256:...",
    "evidence": { "schema": "cool.receipt.v2", ... },
    "agent": "RefundBot",
    "agentVersion": "1.0.0",
    "model": "Demo-Agent",
    "policyVersion": "RefundPolicy-v1",
    "eventType": "agent.refund_approved",
    "decision": "REFUND_APPROVED",
    "amount": 5000,
    "reason": "product_damaged",
    "timestamp": "2026-09-13T09:44:48.000Z",
    "status": "verified"
  }
}
```

### Response `404 Not Found`
```json
{
  "success": false,
  "error": "Event 'EVT-999' not found"
}
```

---

## 6. POST `/api/events/:eventId/tamper-demo`

Used for hackathon audit tampering demonstrations. Safely creates an **isolated copy** of the original evidence receipt with a modified cryptographic hash (e.g. `metadata_hash` or `binding_hash`).

> [!NOTE]
> The original evidence in the database is **never** modified.

### Request Body (Optional)
```json
{
  "tamperType": "metadata_hash"
}
```
*Options:* `"metadata_hash"` (default) or `"binding_hash"`.

### Response `200 OK`
```json
{
  "success": true,
  "tamperId": "tamper_c1c779a1123e",
  "originalEventId": "EVT-001",
  "tamperedField": "record.event.metadata_hash",
  "originalValue": "mh:sha256:7d83f...",
  "tamperedValue": "mh:sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "description": "Modified metadata_hash commitment in evidence core. Expected: binding and signature checks fail.",
  "tamperedEvidence": { ... },
  "verificationPrompt": "Call POST /api/verify-tampered with this tamperId to see CooL detect the modification."
}
```

---

## 7. POST `/api/verify-tampered`

Submits the tampered evidence copy to the official CooL SDK verifier. Demonstrates that CooL's cryptographic checks reject altered receipts.

### Request Body
```json
{
  "tamperId": "tamper_c1c779a1123e"
}
```
*Or verify directly with custom tampered evidence:*
```json
{
  "evidence": { ... }
}
```

### Response `200 OK` (Tampering Detected)
```json
{
  "success": true,
  "valid": false,
  "tamperId": "tamper_c1c779a1123e",
  "originalEventId": "EVT-001",
  "tamperedField": "record.event.metadata_hash",
  "tamperedDescription": "Modified metadata_hash commitment in evidence core. Expected: binding and signature checks fail.",
  "checks": {
    "binding": {
      "status": "fail",
      "detail": "recomputed mh:sha256:... ≠ stored mh:sha256:0000..."
    },
    "signature": {
      "status": "fail",
      "detail": "FAILED — ML-DSA-65 and Ed25519 do not verify over core‖binding_hash"
    },
    "inclusion": {
      "status": "pass",
      "detail": "leaf 0 ∈ tree(1); STH signature valid"
    },
    "witnesses": { "status": "absent", "detail": "..." },
    "attestation": { "status": "simulated", "detail": "..." },
    "enclave": { "status": "simulated", "detail": "..." },
    "anchor": { "status": "absent", "detail": "..." }
  },
  "reasons": [
    "binding: recomputed binding_hash does not match the receipt",
    "signature: ML-DSA-65 and Ed25519 did not verify (record altered or wrong key)"
  ],
  "formattedVerdict": "+----------------------------------------------------------+\n| COOL VERIFIER                                            |\n+----------------------------------------------------------+\n| subject     agent.refund_approved (refund-agent)         |\n| ...                                                      |\n| X   binding      FAILED                                  |\n| X   signature    FAILED                                  |\n+----------------------------------------------------------+\n| RESULT      FAILED                                       |\n+----------------------------------------------------------+\n\nFailures:\n  - binding: recomputed binding_hash does not match the receipt\n  - signature: ML-DSA-65 and Ed25519 did not verify",
  "detectionConfirmed": true
}
```

---

## CORS Configuration
CORS is configured to accept requests from:
- `http://localhost:3000` (Next.js frontend default)
- `http://localhost:5173` (Vite frontend default)
- Any origin configured via `FRONTEND_ORIGIN` env variable
- Any `*.vercel.app` preview deploy

