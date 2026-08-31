"use client";
import { useEffect, useState } from "react";
import { formatApiDate } from "@/utils/date";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AuditTrailPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const url = filter ? `${API}/api/audit?actor_type=${filter}` : `${API}/api/audit`;
    fetch(url).then(r => r.json()).then(r => setEvents(r.events || [])).catch(() => {});
  }, [filter]);

  const actors = ["", "SYSTEM", "MODEL", "WEBHOOK", "MERCHANT"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#02042B]">Audit Trail</h2>
          <p className="text-[#515978] mt-1">Complete append-only log of all system decisions and actions.</p>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 border border-[#E4E6EA] rounded-lg text-sm bg-white">
          <option value="">All Actors</option>
          {actors.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="bg-white border border-[#E4E6EA] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F4F5F8] border-b border-[#E4E6EA] text-[#515978] font-semibold uppercase text-xs tracking-wider">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Journey</th>
              <th className="px-4 py-3">Decision</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((e: any) => (
              <tr key={e.id} className="hover:bg-[#F4F5F8] text-xs">
                <td className="px-4 py-2.5 text-[#8B94A7] font-mono">#{e.id}</td>
                <td className="px-4 py-2.5 text-[#515978]">{formatApiDate(e.timestamp)}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    e.actor_type === 'MODEL' ? 'bg-indigo-100 text-indigo-700' :
                    e.actor_type === 'WEBHOOK' ? 'bg-blue-100 text-blue-700' :
                    e.actor_type === 'MERCHANT' ? 'bg-amber-100 text-amber-700' :
                    'bg-[#F4F5F8] text-[#515978]'
                  }`}>{e.actor_type}</span>
                </td>
                <td className="px-4 py-2.5 font-medium text-[#02042B]">{e.event_type?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2.5 text-[#515978] font-mono">{e.payment_id || '—'}</td>
                <td className="px-4 py-2.5 text-[#515978]">#{e.journey_id || '—'}</td>
                <td className="px-4 py-2.5 text-[#02042B]">{e.decision || '—'}</td>
                <td className="px-4 py-2.5 text-[#515978]">{e.reason || '—'}</td>
                <td className="px-4 py-2.5">{e.new_state ? <span className="bg-[#F4F5F8] text-[#515978] px-2 py-0.5 rounded text-xs">{e.new_state}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
