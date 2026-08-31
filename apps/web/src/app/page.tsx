"use client";

import { ArrowUpRight, ArrowDownRight, ShieldAlert, CheckCircle2, TrendingUp, Zap, Ban, Activity, IndianRupee } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function MetricCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-[#E4E6EA] shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <p className="text-sm font-medium text-[#515978]">{title}</p>
        <div className={`p-2 rounded-lg bg-opacity-10 ${color === 'red' ? 'bg-red-100' : color === 'green' ? 'bg-green-100' : color === 'blue' ? 'bg-blue-100' : 'bg-indigo-100'}`}>
          <Icon className={`w-4 h-4 ${color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'blue' ? 'text-blue-600' : 'text-indigo-600'}`} />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-[#02042B]">{value}</h3>
      <p className="text-xs text-[#8B94A7] mt-1">{subtitle}</p>
    </div>
  );
}

export default function DashboardOverview() {
  const [data, setData] = useState<any>(null);
  const [journeys, setJourneys] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/api/dashboard/overview`).then(r => r.json()).then(setData).catch(() => {});
    fetch(`${API}/api/journeys?limit=8`).then(r => r.json()).then(r => setJourneys(r.journeys || [])).catch(() => {});
  }, []);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  if (!data) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-[#8B94A7]">Loading dashboard...</div></div>;

  const funnelData = [
    { name: 'At Risk', value: data.total_journeys, fill: '#ef4444' },
    { name: 'Evaluated', value: data.total_journeys, fill: '#f59e0b' },
    { name: 'Action Approved', value: Math.max(data.recovered_journeys, data.total_journeys - data.actions_avoided), fill: '#3b82f6' },
    { name: 'Recovered', value: data.recovered_journeys, fill: '#22c55e' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#02042B]">Revenue Recovery</h2>
        <p className="text-[#515978] mt-1">Understand what revenue is at risk, and measure the true incremental impact of AI interventions.</p>
        <div className="mt-2 inline-flex items-center px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-xs font-medium text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 animate-pulse"></span>
          Decision intelligence active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Revenue At Risk" value={fmt(data.revenue_at_risk)} subtitle="Total failed payment value" icon={ShieldAlert} color="red" />
        <MetricCard title="Recorded Gross Recovered" value={fmt(data.gross_recovered)} subtitle="Evaluation outcomes + verified Test Mode events" icon={CheckCircle2} color="green" />
        <MetricCard title="Estimated Incremental" value={fmt(data.estimated_incremental)} subtitle="Causal uplift value (MODEL ESTIMATE)" icon={TrendingUp} color="blue" />
        <MetricCard title="Net Incremental Value" value={fmt(data.net_incremental_value)} subtitle="After intervention costs" icon={Zap} color="indigo" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white px-4 py-3 rounded-lg border border-[#E4E6EA]">
          <p className="text-xs text-[#515978]">Observed Recovery Rate</p>
          <p className="text-lg font-bold text-[#02042B]">{data.recovery_rate}%</p>
        </div>
        <div className="bg-white px-4 py-3 rounded-lg border border-[#E4E6EA]">
          <p className="text-xs text-[#515978]">Actions Avoided (NO_ACTION)</p>
          <p className="text-lg font-bold text-[#02042B]">{data.actions_avoided}</p>
        </div>
        <div className="bg-white px-4 py-3 rounded-lg border border-[#E4E6EA]">
          <p className="text-xs text-[#515978]">Policy Blocks</p>
          <p className="text-lg font-bold text-red-600">{data.policy_blocks}</p>
        </div>
        <div className="bg-white px-4 py-3 rounded-lg border border-[#E4E6EA]">
          <p className="text-xs text-[#515978]">Active Journeys</p>
          <p className="text-lg font-bold text-blue-600">{data.active_journeys}</p>
        </div>
      </div>

      {/* Recovery Funnel */}
      <div className="bg-white p-6 rounded-xl border border-[#E4E6EA] shadow-sm">
        <h3 className="text-lg font-bold text-[#02042B] mb-1">Recovery Funnel</h3>
        <p className="text-sm text-[#515978] mb-4">Journey progression from at-risk to recovered.</p>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 13, fontWeight: 500 }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Journeys */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[#02042B]">Recent Recovery Journeys</h3>
          <Link href="/journeys" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        <div className="bg-white border border-[#E4E6EA] rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F4F5F8] border-b border-[#E4E6EA] text-[#515978] font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Failure</th>
                <th className="px-5 py-3">Selected Action</th>
                <th className="px-5 py-3">Uplift</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journeys.map((j: any) => (
                <tr key={j.id} className="hover:bg-[#F4F5F8] transition-colors cursor-pointer" onClick={() => window.location.href = `/journeys/${j.payment_id}`}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-[#02042B] text-xs font-mono">{j.payment_id}</div>
                    <div className="text-xs text-[#8B94A7]">{j.customer_id}</div>
                  </td>
                  <td className="px-5 py-3 font-semibold text-[#02042B]">₹{j.amount_at_risk?.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-[#515978] text-xs">{j.failure_category}</td>
                  <td className="px-5 py-3 text-[#02042B] font-medium text-xs">{j.selected_action || 'NO_ACTION'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      j.selected_uplift > 0 ? 'bg-green-100 text-green-700' : 'bg-[#F4F5F8] text-[#515978]'
                    }`}>
                      {j.selected_uplift > 0 ? `+${(j.selected_uplift * 100).toFixed(1)}%` : 'Baseline'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      j.status === 'RECOVERED' ? 'bg-green-100 text-green-700' :
                      j.status === 'STOPPED' ? 'bg-red-100 text-red-700' :
                      j.status === 'ESCALATED' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {j.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
