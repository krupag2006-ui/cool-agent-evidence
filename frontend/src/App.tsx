import { FormEvent, useEffect, useRef, useState } from "react";
import { api, type Check, type Decision, type EventDetail, type EventSummary, type RefundResponse, type TamperedVerification, type Verification } from "./api";

type View = "dashboard" | "refund" | "lab" | "receipt" | "verify";
type ReceiptData = RefundResponse | EventDetail;

const checkNames = ["binding", "signature", "inclusion", "witnesses", "attestation", "enclave", "anchor"];

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount / 100);
}

function formatDate(value?: string) {
  if (!value) return "Not returned";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function display(value: unknown) {
  if (value === undefined || value === null || value === "") return "Not returned";
  if (typeof value === "object") return JSON.stringify(value) ?? "Not returned";
  return String(value);
}

function isApproved(decision?: string) {
  return decision === "REFUND_APPROVED";
}

function CheckGrid({ verification }: Readonly<{ verification?: Verification }>) {
  if (!verification?.checks) return <p className="muted">Verification has not been run for this receipt yet.</p>;
  return (
    <div className="check-grid">
      {checkNames.map((name) => {
        const check: Check | undefined = verification.checks?.[name];
        if (!check) return null;
        const status = check.status.toLowerCase();
        return (
          <div className={`check ${status}`} key={name}>
            <div className="check-title"><span className="status-dot" aria-hidden="true" />{name}</div>
            <strong>{check.status}</strong>
            {check.detail && <p>{check.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Verdict({ verification, label = "CooL verdict", validMessage }: Readonly<{ verification?: Verification; label?: string; validMessage?: string }>) {
  if (!verification) return null;
  const valid = verification.valid;
  return (
    <output className={`verdict ${valid ? "valid" : "invalid"}`}>
      <div className="verdict-mark" aria-hidden="true">{valid ? "✓" : "!"}</div>
      <div>
        <span className="eyebrow">{label}</span>
        <h2>{valid ? "VERIFIED / VALID" : "TAMPERED / INVALID"}</h2>
        <p>{valid ? validMessage ?? "CooL verified the evidence receipt and its cryptographic bindings." : "CooL detected that this evidence no longer matches its sealed proof."}</p>
      </div>
    </output>
  );
}

function Field({ label, value, mono = false }: Readonly<{ label: string; value: unknown; mono?: boolean }>) {
  return <div className="field"><span>{label}</span><strong className={mono ? "mono" : ""}>{display(value)}</strong></div>;
}

function getDecision(receipt: ReceiptData): Decision {
  if (typeof receipt.decision !== "string") return receipt.decision;
  return {
    decision: receipt.decision,
    reason: receipt.reason,
    amount: receipt.amount,
    customerId: receipt.customerId ?? "Not returned",
    orderId: receipt.orderId ?? "Not returned",
    agent: receipt.agent,
    agentVersion: receipt.agentVersion,
    model: receipt.model,
    policyVersion: receipt.policyVersion,
    eventType: receipt.eventType,
  };
}

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [verification, setVerification] = useState<Verification | undefined>();
  const [tampered, setTampered] = useState<TamperedVerification | undefined>();
  const [displayedVerification, setDisplayedVerification] = useState<"original" | "tampered">("original");
  const [loading, setLoading] = useState("loading-events");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ customerId: "CUST-9821", orderId: "ORD-54321", amount: "5000", reason: "product_damaged" });

  const loadEvents = async () => {
    setLoading("loading-events");
    try {
      const result = await api.events();
      setEvents(result.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load event history.");
    } finally {
      setLoading("");
    }
  };

  useEffect(() => { void loadEvents(); }, []);

  const submitRefund = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.customerId.trim() || !form.orderId.trim() || !form.reason.trim() || !Number.isFinite(amount) || amount < 0) {
      setError("Enter a customer ID, order ID, reason, and a non-negative amount in cents.");
      return;
    }
    setError("");
    setLoading("submitting-refund");
    try {
      const result = await api.refund({ amount, reason: form.reason, customerId: form.customerId, orderId: form.orderId });
      setReceipt(result);
      setVerification(result.verification);
      setTampered(undefined);
      setDisplayedVerification("original");
      setView("receipt");
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The refund request could not be completed.");
    } finally {
      setLoading("");
    }
  };

  const openEvent = async (eventId: string) => {
    setError("");
    setLoading(`event-${eventId}`);
    try {
      const result = await api.event(eventId);
      setReceipt(result.event);
      setVerification(undefined);
      setTampered(undefined);
      setDisplayedVerification("original");
      setView("receipt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This event could not be loaded.");
    } finally {
      setLoading("");
    }
  };

  const verifyReceipt = async () => {
    if (!receipt) return;
    setError("");
    setLoading("verifying");
    try {
      const result = await api.verify(receipt.eventId);
      setVerification(result);
      setDisplayedVerification("original");
      setView("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CooL verification failed to complete.");
    } finally {
      setLoading("");
    }
  };

  const runTamperDemo = async () => {
    if (!receipt) return;
    setError("");
    setLoading("tampering");
    try {
      const copy = await api.tamper(receipt.eventId);
      const result = await api.verifyTampered(copy.tamperId);
      setTampered(result);
      setDisplayedVerification("tampered");
      setView("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The tamper demonstration failed to complete.");
    } finally {
      setLoading("");
    }
  };

  const nav = (next: View) => { setError(""); setView(next); };
  const pageTitle = { dashboard: "Evidence, made inspectable.", refund: "Record a consequential decision.", lab: "Inspect the evidence layer.", receipt: "Follow the proof.", verify: "Challenge the receipt." }[view];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => nav("dashboard")} aria-label="Go to dashboard">
          <span className="brand-mark">C</span><span>CooL <b>Evidence</b></span>
        </button>
        <nav aria-label="Primary navigation">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => nav("dashboard")}>Dashboard</button>
          <button className={view === "refund" ? "active" : ""} onClick={() => nav("refund")}>New decision</button>
          <button className={view === "lab" || view === "receipt" || view === "verify" ? "active" : ""} onClick={() => nav("lab")}>Evidence lab</button>
        </nav>
      </header>

      <main className="content">
        <div className="page-heading">
          <div><span className="eyebrow">AI action audit console</span><h1>{pageTitle}</h1></div>
          <div className="heading-note"><span className="line" /> Every RefundBot action gets a CooL receipt.</div>
        </div>
        {error && <div className="error" role="alert"><strong>Something needs attention.</strong> {error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

        {view === "dashboard" && <Dashboard events={events} loading={loading} onNew={() => nav("refund")} onOpen={openEvent} />}
        {view === "refund" && <RefundForm form={form} setForm={setForm} onSubmit={submitRefund} loading={loading === "submitting-refund"} />}
        {view === "lab" && <EvidenceLab events={events} loading={loading} onOpen={openEvent} onRefresh={loadEvents} />}
        {view === "receipt" && receipt && <Receipt receipt={receipt} verification={verification} onVerify={verifyReceipt} onTamper={runTamperDemo} loading={loading} onBack={() => nav("dashboard")} />}
        {view === "verify" && receipt && <VerificationView receipt={receipt} verification={verification} tampered={tampered} displayedVerification={displayedVerification} onVerify={verifyReceipt} onTamper={runTamperDemo} loading={loading} />}
        {!receipt && (view === "receipt" || view === "verify") && <EmptyState onNew={() => nav("refund")} />}

        {receipt && view !== "dashboard" && view !== "refund" && <div className="flow-strip"><span>AI ACTION</span><b>→</b><span>COOL EVIDENCE RECORDED</span><b>→</b><span>CRYPTOGRAPHIC PROOF AVAILABLE</span></div>}
      </main>
    </div>
  );
}

function Dashboard({ events, loading, onNew, onOpen }: Readonly<{ events: EventSummary[]; loading: string; onNew: () => void; onOpen: (id: string) => void }>) {
  return <>
    <section className="hero-grid">
      <div className="hero-copy"><div className="kicker">01 / Evidence overview</div><h2>When an agent acts, <em>trust the receipt.</em></h2><p>CooL binds the RefundBot decision to cryptographic evidence you can verify offline, inspect by domain, and challenge on demand.</p><button className="primary" onClick={onNew}>Start refund review <span>↗</span></button></div>
      <div className="signal-card"><div className="signal-top"><span>TRUST SIGNAL</span><span className="live">● LIVE</span></div><div className="ring"><span>{events.length}</span><small>recorded<br />events</small></div><div className="signal-foot"><span>Evidence layer</span><strong>CooL / v3.0.0</strong></div></div>
    </section>
    <section className="section-block"><div className="section-title"><div><span className="eyebrow">Event history</span><h2>Recent agent actions</h2></div><span className="count">{events.length.toString().padStart(2, "0")} EVENTS</span></div>
      {loading === "loading-events" ? <div className="empty"><span className="loader" />Loading recorded evidence...</div> : events.length === 0 ? <div className="empty"><strong>No evidence recorded yet.</strong><p>Run a refund decision to create the first CooL receipt.</p><button type="button" className="secondary" onClick={onNew}>Record first decision</button></div> : <div className="event-table"><div className="table-head"><span>EVENT</span><span>DECISION</span><span>AMOUNT</span><span>STATUS</span><span>WHEN</span></div>{events.map((event) => <button type="button" className="event-row" key={event.eventId} onClick={() => onOpen(event.eventId)}><span><strong>{event.eventId}</strong><small>{event.agent} · {event.reason}</small></span><span className={isApproved(event.decision) ? "approved" : "rejected"}>{event.decision.replace("REFUND_", "")}</span><span>{formatAmount(event.amount)}</span><span><i className="mini-dot" />{event.status}</span><span>{formatDate(event.timestamp)}</span></button>)}</div>}
    </section>
  </>;
}

function EvidenceLab({ events, loading, onOpen, onRefresh }: Readonly<{ events: EventSummary[]; loading: string; onOpen: (id: string) => void; onRefresh: () => void }>) {
  return (
    <section className="section-block">
      <div className="section-title">
        <div>
          <span className="kicker">03 / Evidence lab</span>
          <h2>Open a receipt. Verify the proof.</h2>
          <p>Select a recorded event to inspect its CooL receipt, run the real verifier, and demonstrate isolated tamper detection.</p>
        </div>
        <button type="button" className="secondary" onClick={onRefresh} disabled={loading === "loading-events"}>
          {loading === "loading-events" ? "Refreshing..." : "Refresh events"}
        </button>
      </div>
      {loading === "loading-events" ? <div className="empty"><span className="loader" />Loading recorded evidence...</div> : events.length === 0 ? <div className="empty"><strong>No recorded evidence yet.</strong><p>Submit a refund request first, then return here to inspect its receipt.</p></div> : <div className="event-table"><div className="table-head"><span>EVENT</span><span>DECISION</span><span>AMOUNT</span><span>STATUS</span><span>WHEN</span></div>{events.map((event) => <button type="button" className="event-row" key={event.eventId} onClick={() => onOpen(event.eventId)}><span><strong>{event.eventId}</strong><small>{event.agent} · {event.reason}</small></span><span className={isApproved(event.decision) ? "approved" : "rejected"}>{event.decision.replace("REFUND_", "")}</span><span>{formatAmount(event.amount)}</span><span><i className="mini-dot" />{event.status}</span><span>{formatDate(event.timestamp)}</span></button>)}</div>}
    </section>
  );
}

function RefundForm({ form, setForm, onSubmit, loading }: Readonly<{ form: { customerId: string; orderId: string; amount: string; reason: string }; setForm: (value: { customerId: string; orderId: string; amount: string; reason: string }) => void; onSubmit: (event: FormEvent) => void; loading: boolean }>) {
  return <section className="form-layout"><div className="form-intro"><span className="kicker">02 / RefundBot input</span><h2>Give the agent a real decision to make.</h2><p>RefundBot evaluates the request with <strong>RefundPolicy-v1</strong>, then CooL records both the outcome and its proof.</p><div className="policy-note"><span>POLICY</span><strong>RefundPolicy-v1</strong><small>Eligible reasons under $100.00 are approved. Every decision is recorded, including rejections.</small></div></div><form className="panel form-panel" onSubmit={onSubmit}><div className="panel-heading"><span className="eyebrow">Refund request</span><span className="required">All fields required</span></div><label>Customer ID<input value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} placeholder="CUST-9821" /></label><label>Order ID<input value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} placeholder="ORD-54321" /></label><div className="two-col"><label>Amount <small>in cents</small><input type="number" min="0" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label>Reason<select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option value="product_damaged">Product damaged</option><option value="defective_product">Defective product</option><option value="wrong_item">Wrong item</option><option value="not_received">Not received</option><option value="customer_changed_mind">Customer changed mind</option></select></label></div><button type="submit" className="primary full" disabled={loading}>{loading ? <><span className="button-loader" />Recording with CooL...</> : <>Ask RefundBot to decide <span>→</span></>}</button><p className="form-foot">Your request is sent to the existing RefundBot API. No decision is mocked in this console.</p></form></section>;
}

function Receipt({ receipt, verification, onVerify, onTamper, loading, onBack }: { receipt: ReceiptData; verification?: Verification; onVerify: () => void; onTamper: () => void; loading: string; onBack: () => void }) {
  const decision = getDecision(receipt);
  return <section className="receipt-layout"><div className="receipt-main"><div className="receipt-header"><div><span className="eyebrow">Evidence receipt / {receipt.eventId}</span><h2>{isApproved(decision.decision) ? "Refund approved" : "Refund rejected"}</h2><p>{decision.reason} · recorded {formatDate(receipt.timestamp)}</p></div><span className={`decision-badge ${isApproved(decision.decision) ? "approved" : "rejected"}`}>{decision.decision.replace("REFUND_", "")}</span></div><div className="receipt-card"><div className="receipt-stamp"><span>CooL</span><strong>RECEIPT</strong><small>cool.receipt.v2</small></div><div className="receipt-fields"><Field label="Event ID" value={receipt.eventId} mono /><Field label="Record ID" value={receipt.recordId} mono /><Field label="Execution ID" value={"executionId" in receipt ? receipt.executionId : undefined} mono /><Field label="Digest" value={receipt.digest} mono /><Field label="Evidence status" value={"evidenceStatus" in receipt ? receipt.evidenceStatus?.evidence : "recorded"} /><Field label="Timestamp" value={formatDate(receipt.timestamp)} /></div></div><div className="action-row"><button className="primary" onClick={onVerify} disabled={loading === "verifying"}>{loading === "verifying" ? "Verifying..." : "Verify evidence →"}</button><button className="danger-outline" onClick={onTamper} disabled={loading === "tampering"}>{loading === "tampering" ? "Running demo..." : "Simulate tampering"}</button></div></div><aside className="side-stack"><div className="panel decision-panel"><span className="eyebrow">Decision context</span><Field label="Customer" value={decision.customerId} /><Field label="Order" value={decision.orderId} /><Field label="Amount" value={formatAmount(decision.amount)} /><Field label="Agent" value={`${decision.agent ?? "RefundBot"} / ${decision.agentVersion ?? "1.0.0"}`} /></div><div className="panel proof-panel"><span className="eyebrow">What CooL sealed</span><p>Agent identity, policy, input commitments, output, and execution lineage.</p><div className="proof-line"><i />Salted payload hash</div><div className="proof-line"><i />Hybrid signature</div><div className="proof-line"><i />Merkle inclusion proof</div></div><button className="text-button" onClick={onBack}>← Back to event history</button></aside></section>;
}

function VerificationView({ receipt, verification, tampered, displayedVerification, onVerify, onTamper, loading }: { receipt: ReceiptData; verification?: Verification; tampered?: TamperedVerification; displayedVerification: "original" | "tampered"; onVerify: () => void; onTamper: () => void; loading: string }) {
  const verdictRef = useRef<HTMLDivElement>(null);
  const showTampered = displayedVerification === "tampered" && Boolean(tampered);
  const activeVerification = showTampered ? tampered : verification;

  useEffect(() => {
    verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [displayedVerification]);

  return <section className="verification-page"><div className="verification-top"><div><span className="eyebrow">Verification lab / {receipt.eventId}</span><h2>Proof under a microscope.</h2><p>These checks are returned by the CooL verifier. The RefundBot outcome is not used to infer trust.</p></div><div className="verification-actions"><button type="button" className="secondary" onClick={onVerify} disabled={loading === "verifying"}>{loading === "verifying" ? "Verifying..." : "Re-verify original"}</button><button type="button" className="danger" onClick={onTamper} disabled={loading === "tampering"}>{loading === "tampering" ? "Running..." : "Simulate tampering"}</button></div></div>{showTampered && tampered ? <div className="tamper-comparison"><div className="compare-card original"><span className="eyebrow">Original evidence</span><strong>VALID</strong><p>Untouched receipt remains verifiable in the event store.</p></div><div className="compare-arrow">→</div><div className="compare-card altered"><span className="eyebrow">Tampered copy</span><strong>INVALID</strong><p>{tampered.tamperedDescription}</p><small>Changed field: <span className="mono">{tampered.tamperedField}</span></small></div></div> : null}<div ref={verdictRef}>{showTampered ? <Verdict verification={activeVerification} label="Tampered copy verdict" /> : <Verdict verification={activeVerification} label="CooL verdict" validMessage="Original evidence is intact and cryptographically verifiable." />}</div><div className="checks-heading"><div><span className="eyebrow">Trust domains</span><h3>Structured CooL checks</h3></div>{activeVerification?.attestationDisclaimer && <span className="simulated-note">ⓘ {activeVerification.attestationDisclaimer}</span>}</div><CheckGrid verification={activeVerification} />{activeVerification?.reasons && activeVerification.reasons.length > 0 && <div className="reasons"><strong>Verifier reasons</strong>{activeVerification.reasons.map((reason) => <p key={reason}>! {reason}</p>)}</div>}{activeVerification?.formattedVerdict && <details className="raw-verdict"><summary>View formatted verifier output</summary><pre>{activeVerification.formattedVerdict}</pre></details>}</section>;
}

function EmptyState({ onNew }: { onNew: () => void }) { return <div className="empty page-empty"><strong>Choose an evidence receipt to inspect.</strong><p>There is no active receipt in this session.</p><button className="primary" onClick={onNew}>Record a decision</button></div>; }
