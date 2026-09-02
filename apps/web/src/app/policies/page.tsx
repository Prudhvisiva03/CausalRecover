"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/policies`).then(r => r.json()).then(r => setPolicies(r.policies || [])).catch(() => {});
  }, []);

  const updatePolicy = async (key: string, value: string) => {
    setSaving(key);
    await fetch(`${API}/api/policies`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setSaving(null);
  };

  const categories = [...new Set(policies.map(p => p.category))];
  const policy = (key: string) => policies.find(p => p.key === key)?.value;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#02042B]">Merchant Policies</h2>
        <p className="text-[#515978] mt-1">Configure deterministic guardrails for AI recovery actions.</p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <strong>Policy Summary:</strong> {policies.length === 0 ? "No merchant overrides are stored. Conservative system defaults apply until policies are configured." : `Actions above ₹${policy("human_approval_above_amount") || "—"} require human approval; maximum allowed action cost is ₹${policy("max_action_cost") || "—"}.`}
      </div>

      {policies.length === 0 && <div className="rounded-xl border border-[#E4E6EA] bg-white p-8 text-center text-sm text-[#515978]">No merchant policy records are configured yet.</div>}

      {categories.map(cat => (
        <div key={cat} className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E6EA] bg-[#F4F5F8]">
            <h3 className="text-sm font-bold text-[#02042B] uppercase tracking-wider">{cat}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {policies.filter(p => p.category === cat).map(p => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#02042B]">{p.key.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-[#515978] mt-0.5">{p.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.value === 'true' || p.value === 'false' ? (
                    <button
                      onClick={() => updatePolicy(p.key, p.value === 'true' ? 'false' : 'true')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${p.value === 'true' ? 'bg-blue-600' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${p.value === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  ) : (
                    <input
                      type="text"
                      defaultValue={p.value}
                      onBlur={e => updatePolicy(p.key, e.target.value)}
                      className="w-24 px-3 py-1.5 border border-[#E4E6EA] rounded-lg text-sm text-right"
                    />
                  )}
                  {saving === p.key && <span className="text-xs text-blue-600">Saving...</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
