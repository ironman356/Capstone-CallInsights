import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export default function ScriptPilotPanel({ slug }: { slug: string }) {
  const query = useQuery({ queryKey: ["script-experiments"], queryFn: api.getScriptExperiments });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [unit, setUnit] = useState("");
  const [assigned, setAssigned] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [resolved, setResolved] = useState("");
  const [repeated, setRepeated] = useState("");
  const [delivered, setDelivered] = useState("");
  const [reference, setReference] = useState("");
  const experiment = query.data?.experiments.find(e => e.issue_slug === slug);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); await query.refetch(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); } finally { setBusy(false); }
  }
  return <section className="panel-card script-pilot"><p className="section-kicker">Prospective script comparison</p><h3>Test one change to the conversation</h3>
    <p>The local setup keeps the source response in A and adds one teach-back question in B. It records assignments before outcomes. It does not deploy to your call center or create customer results.</p>
    {query.error && <p role="alert">Could not load experiments. <button onClick={() => void query.refetch()}>Retry</button></p>}
    {error && <p role="alert">{error}</p>}
    {!experiment ? <button className="primary-button" disabled={busy || query.isLoading || !!query.error} onClick={() => void run(() => api.createScriptExperiment(slug))}>Prepare exact A/B scripts for this issue</button> : <>
      <p>{experiment.status} · {experiment.id}</p>
      <div className="discovery-detail-grid"><article className="script-variant"><strong>A / Original wording</strong><blockquote>{experiment.variant_a}</blockquote><small>{experiment.source_call_id} · turn {experiment.source_turn}</small></article><article className="script-variant"><strong>B / Add a teach-back question</strong><blockquote>{experiment.variant_b}</blockquote><small>Proposed intervention; the added sentence is not an observed result</small></article></div>
      <p><strong>Measure:</strong> {experiment.primary_outcome}</p><p>{experiment.result_status}{experiment.difference !== null ? ` · interim B minus A: ${experiment.difference} points` : ""}</p>
      <div className="discovery-rates">{["A", "B"].map(arm => <div key={arm}><strong>{arm}: {experiment.results[arm].success}/{experiment.results[arm].observed}</strong><span>verified successes / observed outcomes · {experiment.results[arm].assigned} assigned</span></div>)}</div>
      <details className="discovery-methods"><summary>What needs to be collected?</summary><p>{experiment.required_fields.join("; ")}.</p><p>{experiment.randomization}</p><p>Planning illustration: {experiment.planning_n_per_arm} calls per arm. {experiment.planning_assumptions}</p><p>Your operations team must approve the wording, use assignments before the call, and provide independent outcomes after the seven-day follow-up. Keep the same customer-issue unit on its original arm. This local prototype uses a single API worker.</p></details>
      <details className="discovery-methods"><summary>Assign a prospective call and record its later outcome</summary>
        <form className="script-pilot-form" onSubmit={e => { e.preventDefault(); void run(async () => { const result = await api.assignScript(experiment.id, unit); setAssigned(`${result.unit_id} → ${result.arm}: ${result.script}`); }); }}><label>Pseudonymous customer-issue unit<input required pattern="[A-Za-z0-9_-]{3,80}" value={unit} onChange={e => setUnit(e.target.value)} placeholder="PILOT_UNIT_001" /></label><button disabled={busy} className="primary-button">Assign before the call</button></form>
        {assigned && <p className="discovery-verdict">{assigned}</p>}
        <form className="script-pilot-form" onSubmit={e => { e.preventDefault(); void run(() => api.recordScriptOutcome(experiment.id, assignmentId, { resolved: resolved === "yes", repeat_contact_7d: repeated === "yes", delivered: delivered === "yes", source_reference: reference })); }}>
          <label>Assignment<select required value={assignmentId} onChange={e => setAssignmentId(e.target.value)}><option value="">Choose an assignment</option>{experiment.assignments.filter(a => a.outcome === null).map(a => <option key={a.id} value={a.id}>{a.unit_id} · {a.arm} · {a.assigned_at.slice(0, 10)}</option>)}</select></label>
          {[["Independently resolved?", resolved, setResolved], ["Repeat contact within 7 days?", repeated, setRepeated], ["Assigned script delivered?", delivered, setDelivered]].map(([label, value, setter]) => <label key={String(label)}>{String(label)}<select required value={String(value)} onChange={e => (setter as (s: string) => void)(e.target.value)}><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></label>)}
          <label>QA/CRM outcome reference<input required minLength={3} maxLength={200} value={reference} onChange={e => setReference(e.target.value)} /></label><button className="primary-button" disabled={busy}>Record after 7-day follow-up</button>
        </form><p>Early or duplicate outcome submissions are rejected. Missing outcomes remain missing; they are never treated as failures.</p>
      </details>
    </>}
  </section>;
}
