"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const readable = (value?: string | null) => {
  if (!value) return "—";
  const labels: Record<string, string> = {
    NO_ACTION: "No action",
    PAYMENT_LINK: "Payment link",
    RETRY_LATER: "Retry later",
    ALTERNATIVE_PAYMENT_METHOD: "Alternative payment method",
    UPDATE_PAYMENT_INSTRUMENT: "Update payment method",
    ISSUER_UNAVAILABLE: "Issuer unavailable",
    INSUFFICIENT_FUNDS: "Insufficient funds",
    AUTHENTICATION_FAILED: "Authentication failed",
    GATEWAY_TECHNICAL_ERROR: "Gateway technical error",
    CARD_EXPIRED: "Card expired",
    BANK_DECLINED: "Bank declined",
    TEST_MODE_RECOVERY_CHECK: "Test recovery verification",
    UNKNOWN: "Needs classification",
    NATURAL_RECOVERY: "Natural recovery",
    NATURAL_RECOVERY_MONITORING: "Natural recovery monitoring",
    RAZORPAY_PAYMENT_LINK_WEBHOOK: "Razorpay payment link webhook",
    AI_RECOVERED: "Recovery verified",
    POLICY_BLOCKED: "Policy blocked",
  };
  return labels[value] || value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
};

const displayFailure = (journey: any) => {
  const reason = (journey.failure_reason || "").toLowerCase();
  if (reason.includes("declined by the bank")) return "Bank declined";
  if (journey.failure_category && journey.failure_category !== "UNKNOWN") return readable(journey.failure_category);
  if (journey.failure_code) return readable(journey.failure_code);
  return "Needs classification";
};

export default function JourneysList() {
  const [journeys, setJourneys] = useState<any[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const url = filter ? `${API}/api/journeys?status=${filter}` : `${API}/api/journeys`;
    fetch(url).then(r => r.json()).then(r => setJourneys(r.journeys || [])).catch(() => {});
  }, [filter]);

  const statuses = ["", "EVALUATING", "ACTION_PENDING", "ACTION_EXECUTED", "WAITING", "RECOVERED", "STOPPED", "ESCALATED"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#02042B]">Recovery Journeys</h2>
          <p className="text-[#515978] mt-1">Each row tracks the failed payment, recovery decision, and its current outcome.</p>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 border border-[#E4E6EA] rounded-lg text-sm bg-white text-[#02042B]">
          <option value="">All Statuses</option>
          {statuses.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white border border-[#E4E6EA] rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-[#F4F5F8] border-b border-[#E4E6EA] text-[#515978] font-semibold uppercase text-xs tracking-wider">
            <tr>
              <th className="px-5 py-3">Journey</th>
              <th className="px-5 py-3">Payment</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Amount At Risk</th>
              <th className="px-5 py-3">Failure</th>
              <th className="px-5 py-3">Selected Action</th>
              <th className="px-5 py-3">Expected Net Value</th>
              <th className="px-5 py-3">Resolution</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {journeys.map((j: any) => (
              <tr key={j.id} className="hover:bg-[#F4F5F8] cursor-pointer" onClick={() => window.location.href = `/journeys/${j.payment_id}`}>
                <td className="px-5 py-3 font-mono text-xs text-[#515978]">#{j.id}</td>
                <td className="px-5 py-3 font-mono text-xs text-[#02042B]">{j.payment_id}</td>
                <td className="px-5 py-3 text-xs text-[#515978]">{j.customer_id || '—'}</td>
                <td className="px-5 py-3 font-semibold text-[#02042B]">₹{j.amount_at_risk?.toLocaleString('en-IN')}</td>
                <td className="px-5 py-3"><span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">{displayFailure(j)}</span></td>
                <td className="px-5 py-3 text-xs font-medium text-[#02042B]">{readable(j.selected_action)}</td>
                <td className="px-5 py-3 text-xs font-semibold">{j.selected_net_value > 0 ? <span className="text-green-600">₹{j.selected_net_value?.toLocaleString('en-IN')}</span> : '—'}</td>
                <td className="px-5 py-3 text-xs text-[#515978]">{readable(j.resolution)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    j.status === 'RECOVERED' ? 'bg-green-100 text-green-700' :
                    j.status === 'STOPPED' ? 'bg-red-100 text-red-700' :
                    j.status === 'ESCALATED' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{j.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
