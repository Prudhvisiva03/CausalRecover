"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/experiments`).then(r => r.json()).then(r => setExperiments(r.experiments || [])).catch(() => {});
    fetch(`${API}/api/experiments/evidence`).then(r => r.json()).then(setEvidence).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#02042B]">Experiments</h2>
        <p className="text-[#515978] mt-1">Treatment vs Control measurement. Gross recovery ≠ incremental recovery.</p>
      </div>

      {evidence && (
        <section className={`rounded-xl border p-5 ${evidence.ready_for_effect_evaluation ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${evidence.ready_for_effect_evaluation ? "text-emerald-700" : "text-amber-700"}`}>Causal evidence gate</p>
              <h3 className="mt-1 text-lg font-bold text-[#02042B]">{evidence.ready_for_effect_evaluation ? "Ready for confidence-interval evaluation" : "Collecting live randomized outcomes"}</h3>
              <p className="mt-1 max-w-3xl text-sm text-[#515978]">{evidence.message}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#515978] shadow-sm">Provider mode: {evidence.source_mode}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-[#515978]">Live treatment assignments</p><p className="mt-1 text-xl font-bold text-[#02042B]">{evidence.treatment?.assigned || 0} <span className="text-sm font-medium">/ {evidence.minimum_per_arm}</span></p></div>
            <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-[#515978]">Live control assignments</p><p className="mt-1 text-xl font-bold text-[#02042B]">{evidence.control?.assigned || 0} <span className="text-sm font-medium">/ {evidence.minimum_per_arm}</span></p></div>
            <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-[#515978]">Test Mode assignments</p><p className="mt-1 text-xl font-bold text-[#02042B]">{evidence.test_assignments || 0}</p></div>
          </div>
        </section>
      )}

      {experiments.map((exp: any) => {
        const treatmentRate = ((exp.treatment_recovery_rate ?? 0) * 100).toFixed(1);
        const controlRate = ((exp.control_recovery_rate ?? 0) * 100).toFixed(1);
        const lift = Number(exp.observed_lift_pp ?? 0).toFixed(1);

        const chartData = [
          { name: 'Treatment', recovery_rate: Number(treatmentRate), count: exp.treatment_count },
          { name: 'Control', recovery_rate: Number(controlRate), count: exp.control_count },
        ];

        return (
          <div key={exp.id} className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#E4E6EA]">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-[#02042B]">{exp.name}</h3>
                  <p className="text-sm text-[#515978] mt-1">{exp.description}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2"><span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-600">Offline benchmark</span><span className={`px-3 py-1 rounded-full text-xs font-bold ${exp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-[#F4F5F8] text-[#515978]'}`}>{exp.status}</span></div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-1">Treatment Group</p>
                    <p className="text-2xl font-bold text-blue-800">{exp.treatment_count}</p>
                    <p className="text-sm text-blue-600">Recovered: {exp.treatment_recovered} ({treatmentRate}%)</p>
                    <p className="text-xs text-blue-500 mt-1">Revenue: ₹{exp.treatment_revenue?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-[#F4F5F8] p-4 rounded-lg">
                    <p className="text-xs text-[#515978] font-medium mb-1">Control Group</p>
                    <p className="text-2xl font-bold text-[#02042B]">{exp.control_count}</p>
                    <p className="text-sm text-[#515978]">Recovered: {exp.control_recovered} ({controlRate}%)</p>
                    <p className="text-xs text-[#515978] mt-1">Revenue: ₹{exp.control_revenue?.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                  <p className="text-xs text-indigo-600 font-medium mb-1">Observed Treatment Uplift</p>
                  <p className="text-3xl font-bold text-indigo-800">{Number(lift) >= 0 ? "+" : ""}{lift} pp</p>
                  <p className="text-xs text-indigo-500 mt-1">Treatment recovery rate vs control recovery rate</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  ⚠ {exp.measurement_label || "Gross recovery is NOT equal to incremental recovery."} Control recovery is the natural-recovery benchmark; this display is not a production-impact claim.
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-[#515978] mb-3">Recovery Rate Comparison</p>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="recovery_rate" name="Recovery Rate %" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
