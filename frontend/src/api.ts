export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export type Check = { status: string; detail?: string };
export type Checks = Record<string, Check>;

export interface Verification {
  valid: boolean;
  subject?: Record<string, unknown> | null;
  checks?: Checks;
  reasons?: string[];
  formattedVerdict?: string;
  attestationDisclaimer?: string;
}

export interface Decision {
  decision: string;
  reason: string;
  amount: number;
  customerId: string;
  orderId: string;
  policyVersion?: string;
  agent?: string;
  agentVersion?: string;
  model?: string;
  eventType?: string;
}

export interface RefundResponse {
  success: boolean;
  decision: Decision;
  eventId: string;
  recordId: string;
  executionId: string;
  digest: string;
  timestamp: string;
  status: string;
  evidence: Record<string, unknown>;
  verification: Verification;
  evidenceStatus?: { evidence?: string; verification?: string };
}

export interface EventSummary {
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

export interface EventDetail extends EventSummary {
  customerId?: string;
  orderId?: string;
  evidence: Record<string, unknown>;
}

export interface TamperResponse {
  success: boolean;
  tamperId: string;
  originalEventId: string;
  tamperedField: string;
  originalValue: string;
  tamperedValue: string;
  description: string;
}

export interface TamperedVerification extends Verification {
  tamperId: string;
  originalEventId: string;
  tamperedField: string;
  tamperedDescription: string;
  detectionConfirmed: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error("The evidence service is unavailable. Start the backend on port 3001 and try again.");
  }

  const body = (await response.json().catch(() => ({}))) as { error?: string; issues?: { message: string }[] };
  if (!response.ok) {
    const issue = body.issues?.map((item) => item.message).join(" ");
    throw new Error(issue || body.error || `Request failed (${response.status})`);
  }
  return body as T;
}

export const api = {
  refund: (payload: { amount: number; reason: string; customerId: string; orderId: string }) =>
    request<RefundResponse>("/api/refund", { method: "POST", body: JSON.stringify(payload) }),
  events: () => request<{ events: EventSummary[] }>("/api/events"),
  event: (eventId: string) => request<{ event: EventDetail }>(`/api/events/${encodeURIComponent(eventId)}`),
  verify: (eventId: string) => request<Verification & { eventId: string; recordId: string }>("/api/verify", {
    method: "POST", body: JSON.stringify({ eventId }),
  }),
  tamper: (eventId: string) => request<TamperResponse>(`/api/events/${encodeURIComponent(eventId)}/tamper-demo`, {
    method: "POST", body: JSON.stringify({ tamperType: "metadata_hash" }),
  }),
  verifyTampered: (tamperId: string) => request<TamperedVerification>("/api/verify-tampered", {
    method: "POST", body: JSON.stringify({ tamperId }),
  }),
};
