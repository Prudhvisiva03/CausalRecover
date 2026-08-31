"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AnalyticsPage() {
  const [byFailure, setByFailure] = useState<any[]>([]);
  const [byAction, setByAction] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/api/analytics/recovery-by-failure`).then(r => r.json()).then(r => setByFailure(r.data || [])).catch(() => {});
    fetch(`${API}/api/analytics/recovery-by-action`).then(r => r.json()).then(r => setByAction(r.data || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#02042B]">Revenue Analytics</h2>
        <p className="text-[#515978] mt-1">Offline evaluation performance by failure type and intervention; validate against live cohorts before making impact claims.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-[#E4E6EA] shadow-sm">
          <h3 className="text-base font-bold text-[#02042B] mb-4">Recovery by Failure Type</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byFailure} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="failure_category" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="total" name="Total Failed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="recovered" name="Recovered" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E4E6EA] shadow-sm">
          <h3 className="text-base font-bold text-[#02042B] mb-4">Net Value by Action Type</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byAction} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="action_type" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}`} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, undefined]} />
                <Bar dataKey="total_net_value" name="Net Incremental Value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E6EA] bg-[#F4F5F8]">
            <h3 className="text-sm font-bold text-[#02042B]">By Failure Category</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-[#515978] uppercase border-b border-[#E4E6EA]/50">
              <tr><th className="px-5 py-2 text-left">Category</th><th className="px-5 py-2 text-right">Total</th><th className="px-5 py-2 text-right">Recovered</th><th className="px-5 py-2 text-right">Rate</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {byFailure.map((f: any) => (
                <tr key={f.failure_category}>
                  <td className="px-5 py-2 text-xs font-medium text-[#02042B]">{f.failure_category}</td>
                  <td className="px-5 py-2 text-right text-[#515978]">{f.total}</td>
                  <td className="px-5 py-2 text-right text-green-600 font-medium">{f.recovered}</td>
                  <td className="px-5 py-2 text-right text-[#02042B] font-bold">{f.total > 0 ? (f.recovered / f.total * 100).toFixed(0) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E6EA] bg-[#F4F5F8]">
            <h3 className="text-sm font-bold text-[#02042B]">By Action Type</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-[#515978] uppercase border-b border-[#E4E6EA]/50">
              <tr><th className="px-5 py-2 text-left">Action</th><th className="px-5 py-2 text-right">Count</th><th className="px-5 py-2 text-right">Avg Uplift</th><th className="px-5 py-2 text-right">Total Net ₹</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {byAction.map((a: any) => (
                <tr key={a.action_type}>
                  <td className="px-5 py-2 text-xs font-medium text-[#02042B]">{a.action_type}</td>
                  <td className="px-5 py-2 text-right text-[#515978]">{a.count}</td>
                  <td className="px-5 py-2 text-right text-blue-600 font-medium">+{(a.avg_uplift * 100).toFixed(1)}%</td>
                  <td className="px-5 py-2 text-right text-green-600 font-bold">₹{a.total_net_value?.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
