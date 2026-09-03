"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ModelsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/models`).then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-[#8B94A7]">Loading models...</div></div>;
  const limitations = Array.isArray(data.limitations) ? data.limitations : data.limitations ? [data.limitations] : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#02042B]">Offline Model Registry</h2>
        <p className="text-[#515978] mt-1">Training artifacts and offline validation diagnostics — not production performance claims.</p>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        <p className="font-bold">⚠ Important limitations</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">{limitations.map((limitation: string) => <li key={limitation}>{limitation}</li>)}</ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.models?.map((m: any, i: number) => (
          <div key={i} className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm p-5">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-[#02042B]">{m.name}</h3>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-xs font-bold text-amber-700">{m.status.replace(/_/g, " ")}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#515978]">Version</span><span className="text-[#02042B] font-medium">{m.version}</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Algorithm</span><span className="text-[#02042B] font-medium">{m.algorithm}</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Approach</span><span className="text-[#02042B] font-medium">{m.approach}</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Training Size</span><span className="text-[#02042B] font-medium">{m.dataset_size.toLocaleString()} rows</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Test Size</span><span className="text-[#02042B] font-medium">{m.test_size.toLocaleString()} rows</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Training schema</span><span className="text-[#02042B] font-medium">{m.features?.length} features</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Trained</span><span className="text-[#02042B] font-medium">{m.trained_at}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#E4E6EA]/50">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-[#515978]">Offline ROC-AUC</p><p className="mt-1 font-semibold text-[#02042B]">{m.roc_auc?.toFixed(3) ?? "Unavailable"}</p></div>
                <div><p className="text-[#515978]">Offline Brier score</p><p className="mt-1 font-semibold text-[#02042B]">{m.brier_score?.toFixed(3) ?? "Unavailable"}</p></div>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#515978]">These are held-out semi-synthetic validation metrics. They do not measure merchant impact or prove causal uplift.</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#02042B]">Runtime input coverage</h3>
          <p className="mt-1 text-xs leading-5 text-[#515978]">Inputs received from Razorpay and merchant records when available.</p>
          <ul className="mt-3 space-y-1.5 text-xs text-[#02042B]">{data.runtime_inputs?.map((input: string) => <li key={input}>• {input}</li>)}</ul>
        </div>
        <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#02042B]">Neutral defaults for unavailable inputs</h3>
          <p className="mt-1 text-xs leading-5 text-[#515978]">These fields are not currently supplied by the integration and are not presented as live data.</p>
          <ul className="mt-3 space-y-1.5 text-xs text-[#02042B]">{data.imputed_inputs?.map((input: string) => <li key={input}>• {input}</li>)}</ul>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#02042B] mb-3">Validation dataset</h3>
        <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">{data.dataset_label}</span>
        <p className="mt-2 text-xs leading-5 text-[#515978]">{data.runtime_note}</p>
      </div>
    </div>
  );
}
