"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { formatApiDate } from "@/utils/date";
import { ShieldAlert, Activity, Zap, Clock, CheckCircle2, ArrowRight, XCircle, AlertTriangle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const readable = (value?: string | null) => {
  if (!value) return "—";
  const labels: Record<string, string> = {
    PAYMENT_LINK: "Payment link",
    ACTION_PENDING: "Action pending",
    RECOVERY_WORKFLOW_INITIATED: "Recovery workflow initiated",
    RAZORPAY_TEST_PAYMENT_LINK_CREATED: "Razorpay Test payment link created",
    RAZORPAY_API_RECONCILIATION: "Verified through Razorpay API reconciliation",
    TEST_MODE_RECOVERY_WORKFLOW_REQUESTED: "Test Mode recovery workflow requested",
    MERCHANT_APPROVAL: "Approved by merchant",
    PAYMENT_FAILED: "Original payment failed",
    ACTION_APPROVED: "Recovery action approved",
    ACTION_DISPATCHED: "Recovery action dispatched",
    PAYMENT_RECOVERED: "Recovery payment completed",
    RECOVERED: "Recovered",
    COMPLETED: "Completed",
    APPROVED: "Approved",
    PENDING: "Pending review",
    EXECUTING: "Executing",
    FAILED: "Failed",
    WAITING: "Waiting",
    RAZORPAY_API: "Razorpay",
    MERCHANT: "Merchant",
    SYSTEM: "System",
    WEBHOOK: "Webhook",
  };
  return labels[value] || value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
};

const displayFailure = (payment: any) => {
  const reason = (payment?.failure_reason || "").toLowerCase();
  if (reason.includes("declined by the bank")) return "Bank declined (unclassified)";
  if (reason.includes("cancelled")) return "Payment cancelled";
  return readable(payment?.failure_category);
};

const displayAuditReason = (reason?: string | null) => reason?.includes("_") ? readable(reason) : reason || "—";

export default function JourneyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState<number | null>(null);
  const [reconciling, setReconciling] = useState<number | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    const loadJourney = () => {
      fetch(`${API}/api/payments/${id}`)
        .then(r => r.json())
        .then(d => { if (active) { setData(d); setLoading(false); } })
        .catch(() => { if (active) setLoading(false); });
    };
    loadJourney();
    const refreshTimer = window.setInterval(loadJourney, 5000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-[#8B94A7]">Analyzing payment...</div></div>;
  if (!data || !data.payment) return <div className="text-center py-20 text-[#515978]">Payment not found.</div>;

  const { payment, customer, journey, candidates, audit_trail } = data;
  const selected = candidates?.find((c: any) => c.is_selected);
  const noAction = candidates?.find((c: any) => c.action_type === "NO_ACTION");
  const isRecovered = journey?.status === "RECOVERED" || payment.status === "recovered";
  const recoveryAudit = (audit_trail || []).find((a: any) => a.event_type === "PAYMENT_RECOVERED");
  const successfulPaymentId = recoveryAudit?.metadata?.successful_payment_id;
  const recoveredPaymentLinkId = recoveryAudit?.metadata?.payment_link_id;
  const isTestModeRecovery = journey?.resolution === "RAZORPAY_API_RECONCILIATION" || payment.failure_code?.startsWith("TEST_MODE_");
  const paymentContext = [payment.customer_id ? `Customer: ${payment.customer_id}` : null, payment.order_id ? `Order: ${payment.order_id}` : null].filter(Boolean).join(" • ");

  const dispatchSandbox = async (actionId: number) => {
    setDispatching(actionId);
    try {
      const dispatch = await fetch(`${API}/api/actions/${actionId}/dispatch`, { method: "POST" });
      const dispatchData = await dispatch.json();
      if (!dispatch.ok) throw new Error(dispatchData.detail || "Dispatch failed");
      if (dispatchData.payment_link) setPaymentLinks(current => ({ ...current, [actionId]: dispatchData.payment_link }));
      const response = await fetch(`${API}/api/payments/${id}`);
      setData(await response.json());
    } finally {
      setDispatching(null);
    }
  };

  const reconcileRazorpay = async (actionId: number) => {
    setReconciling(actionId);
    try {
      const result = await fetch(`${API}/api/actions/${actionId}/reconcile`, { method: "POST" });
      const resultData = await result.json();
      if (!result.ok) throw new Error(resultData.detail || "Verification failed");
      const response = await fetch(`${API}/api/payments/${id}`);
      setData(await response.json());
    } finally {
      setReconciling(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#515978]">
        <Link href="/" className="hover:text-blue-600">Overview</Link>
        <ArrowRight className="w-3 h-3" />
        <Link href="/journeys" className="hover:text-blue-600">Journeys</Link>
        <ArrowRight className="w-3 h-3" />
        <span className="text-[#02042B] font-medium">{payment.id}</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-[#02042B] flex items-center gap-3">
            ₹{payment.amount?.toLocaleString('en-IN')}
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
              payment.status === 'recovered' ? 'bg-green-100 text-green-700' :
              journey?.status === 'STOPPED' ? 'bg-red-100 text-red-700' :
              journey?.status === 'ESCALATED' ? 'bg-amber-100 text-amber-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {journey?.status || payment.status}
            </span>
          </h2>
          {paymentContext && <p className="text-[#515978] mt-1">{paymentContext}</p>}
        </div>
      </div>

      {isRecovered && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-950">₹{journey?.recovered_amount?.toLocaleString("en-IN")} recovery verified</p>
              <p className="mt-1 text-sm leading-5 text-emerald-800">
                The recovery payment completed and was verified through Razorpay API reconciliation{journey?.resolved_at ? ` on ${formatApiDate(journey.resolved_at)}` : ""}.
                {isTestModeRecovery && " This is a Razorpay Test Mode verification, not a live settlement."}
              </p>
              {successfulPaymentId && <p className="mt-3 break-all text-sm font-semibold text-emerald-950">Successful retry payment: {successfulPaymentId}</p>}
              {recoveredPaymentLinkId && <p className="mt-1 break-all text-xs text-emerald-800">Razorpay Payment Link: {recoveredPaymentLinkId}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* A. Failure Diagnosis */}
        <div className="bg-white p-6 rounded-xl border border-[#E4E6EA] shadow-sm col-span-2">
          <h3 className="text-base font-bold text-[#02042B] mb-4 flex items-center gap-2">
            <ShieldAlert className={`w-5 h-5 ${isRecovered ? "text-amber-500" : "text-red-500"}`} />
            {isRecovered && isTestModeRecovery ? "Test Mode Recovery Scenario" : isRecovered ? "Original Payment Failure" : "Failure Diagnosis"}
          </h3>
          {isRecovered && <p className="-mt-2 mb-4 text-sm text-[#515978]">{isTestModeRecovery ? "This manually initiated Test Mode scenario started the recovery workflow; the payment outcome is confirmed above." : "This is the original failure that started the journey; the recovery outcome is confirmed above."}</p>}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-[#515978] mb-1">Provider</p><p className="font-semibold text-[#02042B]">Razorpay</p></div>
            <div><p className="text-[#515978] mb-1">{isTestModeRecovery ? "Test scenario type" : isRecovered ? "Original failure type" : "Normalized Failure"}</p><p className={`font-semibold ${isRecovered ? "text-amber-700" : "text-red-600"}`}>{displayFailure(payment)}</p></div>
            <div><p className="text-[#515978] mb-1">Source → Step</p><p className="font-semibold text-[#02042B]">{readable(payment.failure_source)} → {readable(payment.failure_step)}</p></div>
            <div><p className="text-[#515978] mb-1">{isTestModeRecovery ? "Scenario reason" : "Initial failure reason"}</p><p className="text-[#02042B]">{payment.failure_reason}</p></div>
            <div><p className="text-[#515978] mb-1">Payment Method</p><p className="font-semibold text-[#02042B] uppercase">{payment.method}</p></div>
            <div><p className="text-[#515978] mb-1">{isTestModeRecovery ? "Scenario recorded" : "Initial failure recorded"}</p><p className="font-semibold text-[#02042B]">{formatApiDate(payment.created_at)}</p><p className="mt-1 text-xs text-[#8B94A7]">Provider checkout outcomes appear in the event timeline.</p></div>
          </div>
        </div>

        {/* B. Risk Assessment */}
        <div className="bg-white p-6 rounded-xl border border-[#E4E6EA] shadow-sm">
          <h3 className="text-base font-bold text-[#02042B] mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            Risk Assessment
          </h3>
          <div className="space-y-4">
            {candidates?.length === 0 && isTestModeRecovery ? (
              <div className="rounded-lg bg-slate-50 p-3 text-sm leading-5 text-[#515978]">
                This Test Mode workflow was manually approved for verification. No model estimate was generated, so no recovery probability is being claimed.
              </div>
            ) : (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#515978]">Natural Recovery Probability</span>
                <span className="font-bold text-[#02042B]">{((noAction?.probability || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#F4F5F8] rounded-full h-2.5">
                <div className="bg-indigo-500 h-2.5 rounded-full transition-all" style={{ width: `${(noAction?.probability || 0) * 100}%` }}></div>
              </div>
            </div>
            )}
            {customer && (
              <>
                <div className="pt-3 border-t border-[#E4E6EA]/50 text-sm">
                  <p className="text-[#515978] mb-1">Customer Success Rate</p>
                  <p className="font-semibold text-[#02042B]">{((customer.historical_success_rate || 0) * 100).toFixed(0)}%</p>
                </div>
                <div className="text-sm">
                  <p className="text-[#515978] mb-1">Contact Consent</p>
                  <p className={`font-semibold ${customer.contact_consent ? 'text-green-600' : 'text-red-600'}`}>
                    {customer.contact_consent ? '✓ Granted' : '✗ Not Available'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* C. Candidate Action Comparison */}
      {candidates && candidates.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#E4E6EA] bg-[#F4F5F8]">
            <h3 className="text-base font-bold text-[#02042B] flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Causal Action Optimization
            </h3>
            <p className="text-sm text-[#515978] mt-1">Comparing predicted incrementality against the baseline (NO_ACTION).</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-white border-b border-[#E4E6EA] text-[#515978] font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-5 py-3">Rank</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">P(Recovery)</th>
                <th className="px-5 py-3 text-blue-700">Incremental Uplift</th>
                <th className="px-5 py-3">Cost</th>
                <th className="px-5 py-3">Expected Inc. ₹</th>
                <th className="px-5 py-3">Net Inc. ₹</th>
                <th className="px-5 py-3">Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EA]">
              {(candidates || []).map((c: any) => (
                <tr key={c.id} className={c.is_selected ? "bg-blue-50/60" : "hover:bg-[#F4F5F8]"}>
                  <td className="px-5 py-3 text-[#8B94A7] font-mono">#{c.rank}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#02042B]">{c.action_type}</span>
                      {c.is_selected && <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Selected</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-[#515978]">{(c.probability * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3">
                    <span className={`font-bold ${c.uplift > 0 ? 'text-blue-600' : 'text-[#8B94A7]'}`}>
                      {c.uplift > 0 ? `+${(c.uplift * 100).toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#515978]">₹{c.action_cost}</td>
                  <td className="px-5 py-3 text-[#515978]">₹{c.expected_incremental_revenue?.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 font-bold text-[#02042B]">{c.net_incremental_value > 0 ? `₹${c.net_incremental_value?.toLocaleString('en-IN')}` : c.action_type === 'NO_ACTION' ? 'Baseline' : `₹${c.net_incremental_value}`}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                      c.policy_status === 'ALLOW' ? 'bg-green-100 text-green-700' :
                      c.policy_status === 'BLOCK' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {c.policy_status === 'ALLOW' ? <CheckCircle2 className="w-3 h-3" /> : c.policy_status === 'BLOCK' ? <XCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {c.policy_status}
                    </span>
                    {c.policy_reason && c.policy_reason !== "POLICY_CHECKS_PASSED" && c.policy_reason !== "Baseline action" && (
                      <p className="text-[10px] text-[#8B94A7] mt-0.5">{c.policy_reason}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* D. Decision Reasoning */}
      {selected && (
        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
          <h3 className="text-base font-bold mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            AI Decision Reasoning
          </h3>
          <p className="text-slate-300 leading-relaxed">
            {selected.action_type === "NO_ACTION" ? <><strong className="text-white">No action</strong> was selected as the baseline because every intervention was blocked by merchant policy or did not meet the minimum economic threshold. No customer recovery workflow will be dispatched automatically.</> : <><strong className="text-white">{selected.action_type}</strong> was selected because it produces the highest policy-compliant
            <strong className="text-blue-400"> Net Expected Incremental Value (₹{selected.net_incremental_value?.toLocaleString('en-IN')})</strong>.
            {noAction && <span> The natural recovery probability is {(noAction.probability * 100).toFixed(1)}%, meaning without intervention there is already a {(noAction.probability * 100).toFixed(1)}% chance of recovery. The selected action adds an estimated <strong className="text-green-400">+{(selected.uplift * 100).toFixed(1)}%</strong> incremental uplift.</span>}
            {journey?.resolution === "POLICY_BLOCKED" && <span className="text-red-300"> However, this journey was ultimately BLOCKED by merchant policy constraints.</span>}</>}
          </p>
        </div>
      )}

      {data.actions?.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E6EA] shadow-sm">
          <div className="flex items-start justify-between gap-6 mb-4">
            <div>
              <h3 className="text-base font-bold text-[#02042B]">Bounded Recovery Workflow</h3>
              <p className="text-sm text-[#515978] mt-1">Dispatch is policy-gated, traceable, and linked to the recovery outcome timeline.</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">POLICY-GATED</span>
          </div>
          <div className="space-y-3">
            {data.actions.map((action: any) => (
              <div key={action.id} className="rounded-lg border border-[#E4E6EA] p-4 flex flex-wrap gap-4 items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#02042B]">{readable(action.action_type)}</p>
                  <p className="text-xs text-[#515978] mt-1">
                    {candidates?.length > 0 ? `Expected net incremental value: ₹${action.estimated_value?.toLocaleString("en-IN")}` : "Merchant-approved Test Mode recovery workflow"}
                  </p>
                  {action.status === "COMPLETED" && isRecovered && <p className="mt-1 text-xs font-semibold text-emerald-700">Verified recovered: ₹{journey?.recovered_amount?.toLocaleString("en-IN")}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${action.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : action.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"}`}>{readable(action.status)}</span>
                  {action.status === "APPROVED" && (
                    <button onClick={() => dispatchSandbox(action.id)} disabled={dispatching === action.id} className="rounded-lg bg-[#3366FF] px-3 py-2 text-xs font-bold text-white hover:bg-[#2852cc] disabled:bg-blue-300">
                      {dispatching === action.id ? "Dispatching…" : "Dispatch action"}
                    </button>
                  )}
                  {action.status === "PENDING" && <Link href="/actions" className="rounded-lg border border-[#3366FF] px-3 py-2 text-xs font-bold text-[#3366FF] hover:bg-blue-50">Review in Action Queue</Link>}
                  {action.action_type === "PAYMENT_LINK" && ["EXECUTING", "FAILED"].includes(action.status) && (
                    <button onClick={() => reconcileRazorpay(action.id)} disabled={reconciling === action.id} className="rounded-lg border border-[#3366FF] px-3 py-2 text-xs font-bold text-[#3366FF] hover:bg-blue-50 disabled:opacity-50">
                      {reconciling === action.id ? "Verifying…" : "Verify Razorpay status"}
                    </button>
                  )}
                </div>
                {paymentLinks[action.id] && (
                  <a href={paymentLinks[action.id]} target="_blank" rel="noreferrer" className="w-full text-xs font-bold text-[#3366FF] hover:underline">
                    Open Razorpay Test payment link →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* E. Audit Timeline */}
      {audit_trail && audit_trail.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E6EA] shadow-sm">
          <h3 className="text-base font-bold text-[#02042B] mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#8B94A7]" />
            Event Timeline
          </h3>
          <div className="space-y-4">
            {(audit_trail || []).map((a: any, i: number) => (
              <div key={a.id} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full mt-1 ${
                    a.event_type.includes('RECOVERED') ? 'bg-green-500' :
                    a.event_type.includes('BLOCKED') ? 'bg-red-500' :
                    a.event_type.includes('FAILED') ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}></div>
                  {i < audit_trail.length - 1 && <div className="w-px h-6 bg-slate-200"></div>}
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <p className="text-sm font-semibold text-[#02042B]">{isTestModeRecovery && a.event_type === "PAYMENT_FAILED" ? "Test Mode recovery scenario initiated" : readable(a.event_type)}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#515978]">
                    {a.timestamp && <span>{formatApiDate(a.timestamp)}</span>}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{readable(a.actor_type)}</span>
                    {a.decision && <span><span className="text-[#8B94A7]">Action:</span> {readable(a.decision)}</span>}
                    {a.new_state && <span className={`rounded-full px-2 py-0.5 font-semibold ${a.new_state === 'WAITING' ? 'bg-blue-50 text-blue-700' : a.new_state === 'ACTION_PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{readable(a.new_state)}</span>}
                  </div>
                  {a.reason && <p className="mt-2 max-w-4xl text-sm leading-5 text-[#515978]">{displayAuditReason(a.reason)}</p>}
                  {a.metadata?.successful_payment_id && <p className="mt-1 break-all text-xs font-semibold text-emerald-700">Successful retry payment: {a.metadata.successful_payment_id}</p>}
                  {a.metadata?.payment_link_id && <p className="mt-1 break-all text-xs text-[#515978]">Razorpay Payment Link: {a.metadata.payment_link_id}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
