"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleX, ExternalLink, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const readable = (value?: string | null) => {
  if (!value) return "—";
  const labels: Record<string, string> = {
    PAYMENT_LINK: "Payment link", RETRY_LATER: "Retry later", CUSTOMER_NUDGE: "Customer nudge",
    ALTERNATIVE_PAYMENT_METHOD: "Alternative payment method", UPDATE_PAYMENT_INSTRUMENT: "Update payment method",
    PENDING: "Pending approval", APPROVED: "Approved", EXECUTING: "Waiting for payment", SCHEDULED: "Scheduled",
    COMPLETED: "Completed", FAILED: "Checkout failed", CANCELLED: "Cancelled", BLOCKED: "Blocked",
  };
  return labels[value] || value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
};

const statusStyle = (status: string) => {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["FAILED", "CANCELLED", "BLOCKED"].includes(status)) return "bg-red-50 text-red-700 border-red-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
};

const formatMoney = (value?: number | null) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ActionQueuePage() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/actions`);
      if (!response.ok) throw new Error("Could not load recovery actions");
      const payload = await response.json();
      setActions(payload.actions || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load recovery actions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id: number, operation: "approve" | "cancel" | "dispatch") => {
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch(`${API}/api/actions/${id}/${operation}`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Action update failed");
      setNotice(operation === "dispatch" && payload.payment_link ? "Razorpay Test payment link created. Open it below to continue the recovery." : `${readable(operation)} completed.`);
      if (payload.payment_link) window.open(payload.payment_link, "_blank", "noopener,noreferrer");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action update failed");
    } finally {
      setBusy(null);
    }
  };

  const pending = actions.filter(action => action.status === "PENDING").length;
  const live = actions.filter(action => ["APPROVED", "SCHEDULED", "EXECUTING"].includes(action.status)).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#02042B]">Recovery Action Queue</h2>
          <p className="mt-1 text-[#515978]">Review policy-approved actions before a customer recovery workflow is sent.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-[#E4E6EA] bg-white px-3 py-2 text-sm font-semibold text-[#02042B] hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Awaiting merchant review</p><p className="mt-1 text-2xl font-bold text-amber-900">{pending}</p></div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">Active recovery workflows</p><p className="mt-1 text-2xl font-bold text-blue-900">{live}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-600">Total actions</p><p className="mt-1 text-2xl font-bold text-[#02042B]">{actions.length}</p></div>
      </div>

      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p><strong>Guardrailed workflow:</strong> approvals and cancellations are recorded in the audit trail. Razorpay actions use Test Mode; no real money is collected.</p>
      </div>

      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-[#E4E6EA] bg-white shadow-sm">
        {loading ? <div className="flex h-56 items-center justify-center text-sm text-[#515978]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading recovery actions…</div> : actions.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center text-center"><CheckCircle2 className="h-8 w-8 text-emerald-500" /><p className="mt-3 font-semibold text-[#02042B]">Action queue is clear</p><p className="mt-1 text-sm text-[#515978]">New payment failures will appear here after evaluation.</p></div>
        ) : (
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[#E4E6EA] bg-[#F4F5F8] text-xs font-semibold uppercase tracking-wider text-[#515978]"><tr><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Recommended action</th><th className="px-5 py-3">Expected net value</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Reason / provider</th><th className="px-5 py-3 text-right">Controls</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {actions.map(action => <tr key={action.id} className="hover:bg-slate-50">
                <td className="px-5 py-4"><Link href={`/journeys/${action.payment_id}`} className="font-mono text-xs font-semibold text-[#02042B] hover:text-[#3366FF]">{action.payment_id}</Link><p className="mt-1 text-xs text-[#8B94A7]">Journey #{action.journey_id} · ₹{action.amount?.toLocaleString("en-IN")}</p></td>
                <td className="px-5 py-4 font-semibold text-[#02042B]">{readable(action.action_type)}</td>
                <td className="px-5 py-4 font-semibold text-emerald-600">{formatMoney(action.estimated_value)}<span className="ml-1 text-xs font-normal text-[#8B94A7]">estimate</span></td>
                <td className="px-5 py-4"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(action.status)}`}>{readable(action.status)}</span></td>
                <td className="max-w-[260px] px-5 py-4 text-xs text-[#515978]">{action.failure_reason || action.provider_reference || "Awaiting workflow update"}</td>
                <td className="px-5 py-4"><div className="flex justify-end gap-2">{action.status === "PENDING" && <><button onClick={() => update(action.id, "approve")} disabled={busy === action.id} className="rounded-lg border border-[#3366FF] px-3 py-2 text-xs font-bold text-[#3366FF] hover:bg-blue-50 disabled:opacity-50">Approve</button><button onClick={() => update(action.id, "cancel")} disabled={busy === action.id} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Cancel</button></>}{action.status === "APPROVED" && <button onClick={() => update(action.id, "dispatch")} disabled={busy === action.id} className="inline-flex items-center gap-1 rounded-lg bg-[#3366FF] px-3 py-2 text-xs font-bold text-white hover:bg-[#2852cc] disabled:opacity-50">{busy === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Dispatch</button>}{action.provider_reference && <Link href={`/journeys/${action.payment_id}`} className="inline-flex items-center rounded-lg border border-[#E4E6EA] px-2 text-[#515978] hover:bg-slate-50" aria-label="Open journey"><ExternalLink className="h-3.5 w-3.5" /></Link>}</div></td>
              </tr>)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
