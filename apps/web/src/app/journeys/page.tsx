"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
          <p className="text-[#515978] mt-1">Multi-step recovery stories from failure to resolution.</p>
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
              <th className="px-5 py-3">Net Value</th>
              <th className="px-5 py-3">Resolution</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {journeys.map((j: any) => (
              <tr key={j.id} className="hover:bg-[#F4F5F8] cursor-pointer" onClick={() => window.location.href = `/journeys/${j.payment_id}`}>
                <td className="px-5 py-3 font-mono text-xs text-[#515978]">#{j.id}</td>
                <td className="px-5 py-3 font-mono text-xs text-[#02042B]">{j.payment_id}</td>
                <td className="px-5 py-3 text-xs text-[#515978]">{j.customer_id}</td>
                <td className="px-5 py-3 font-semibold text-[#02042B]">₹{j.amount_at_risk?.toLocaleString('en-IN')}</td>
                <td className="px-5 py-3"><span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">{j.failure_category}</span></td>
                <td className="px-5 py-3 text-xs font-medium">{j.selected_action || 'NO_ACTION'}</td>
                <td className="px-5 py-3 text-xs font-semibold">{j.selected_net_value > 0 ? <span className="text-green-600">₹{j.selected_net_value?.toLocaleString('en-IN')}</span> : '—'}</td>
                <td className="px-5 py-3 text-xs text-[#515978]">{j.resolution || '—'}</td>
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
