"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ModelsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/models`).then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-[#8B94A7]">Loading models...</div></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#02042B]">Model Intelligence</h2>
        <p className="text-[#515978] mt-1">ML model registry and performance transparency.</p>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        <strong>⚠ Important:</strong> {data.limitations}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.models?.map((m: any, i: number) => (
          <div key={i} className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm p-5">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-[#02042B]">{m.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-[#F4F5F8] text-[#515978]'}`}>{m.status}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#515978]">Version</span><span className="text-[#02042B] font-medium">{m.version}</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Algorithm</span><span className="text-[#02042B] font-medium">{m.algorithm}</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Approach</span><span className="text-[#02042B] font-medium">{m.approach}</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Training Size</span><span className="text-[#02042B] font-medium">{m.dataset_size.toLocaleString()} rows</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Test Size</span><span className="text-[#02042B] font-medium">{m.test_size.toLocaleString()} rows</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Features</span><span className="text-[#02042B] font-medium">{m.features?.length}</span></div>
              <div className="flex justify-between"><span className="text-[#515978]">Trained</span><span className="text-[#02042B] font-medium">{m.trained_at}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#E4E6EA]/50">
              <p className="text-xs text-[#515978]">Features: <span className="text-[#02042B] font-mono">{m.features?.join(', ')}</span></p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#02042B] mb-3">Dataset Label</h3>
        <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">{data.dataset_label}</span>
        <p className="text-xs text-[#515978] mt-2">Model validation is maintained separately from operational recovery measurement and reviewed through the model card.</p>
      </div>
    </div>
  );
}
