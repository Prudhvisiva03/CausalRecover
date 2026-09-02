"use client";
import { useState } from "react";
import { Zap, CheckCircle2, XCircle, AlertTriangle, Activity } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DecisionLab() {
  const [amount, setAmount] = useState<number | "">("");
  const [failureCat, setFailureCat] = useState("ISSUER_UNAVAILABLE");
  const [method, setMethod] = useState("card");
  const [histRate, setHistRate] = useState(0.65);
  const [consent, setConsent] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const evaluate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/simulator/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount), failure_category: failureCat, payment_method: method,
          historical_success_rate: histRate, contact_consent: consent,
        }),
      });
      setResult(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#02042B]">Decision Lab</h2>
        <p className="text-[#515978] mt-1">Simulate recovery strategy evaluation. No money actions are executed.</p>
        <div className="mt-2 inline-flex items-center px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-xs font-medium text-indigo-700">
          Decision Preview — Actions require approval before dispatch
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white p-6 rounded-xl border border-[#E4E6EA] shadow-sm">
        <h3 className="text-base font-bold text-[#02042B] mb-4">Configure Scenario</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-[#515978] block mb-1">Amount (₹)</label>
            <input type="number" min="0.01" placeholder="Enter a test amount" value={amount} onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 border border-[#E4E6EA] rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#515978] block mb-1">Failure Category</label>
            <select value={failureCat} onChange={e => setFailureCat(e.target.value)} className="w-full px-3 py-2 border border-[#E4E6EA] rounded-lg text-sm bg-white">
              <option>ISSUER_UNAVAILABLE</option>
              <option>INSUFFICIENT_FUNDS</option>
              <option>CARD_EXPIRED</option>
              <option>AUTHENTICATION_FAILED</option>
              <option>UNKNOWN</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#515978] block mb-1">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full px-3 py-2 border border-[#E4E6EA] rounded-lg text-sm bg-white">
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="netbanking">Netbanking</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#515978] block mb-1">Historical Success Rate</label>
            <input type="number" step="0.05" min="0" max="1" value={histRate} onChange={e => setHistRate(Number(e.target.value))} className="w-full px-3 py-2 border border-[#E4E6EA] rounded-lg text-sm" />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="rounded" />
              <span className="text-[#515978]">Contact Consent</span>
            </label>
          </div>
          <div className="flex items-end">
            <button onClick={evaluate} disabled={loading || amount === "" || amount <= 0} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium transition-colors text-sm">
              {loading ? "Evaluating..." : "Evaluate Recovery Strategy"}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#E4E6EA] bg-[#F4F5F8] flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#02042B] flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Causal Action Analysis
                </h3>
              </div>
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
                Selected: {result.selected_action}
              </span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b border-[#E4E6EA] text-[#515978] font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">P(Recovery)</th>
                  <th className="px-5 py-3">Uplift</th>
                  <th className="px-5 py-3">Cost</th>
                  <th className="px-5 py-3">Net Inc. Value</th>
                  <th className="px-5 py-3">Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.candidates?.map((c: any) => (
                  <tr key={c.action_type} className={c.is_selected ? "bg-blue-50/60" : ""}>
                    <td className="px-5 py-3 text-[#8B94A7]">{c.rank}</td>
                    <td className="px-5 py-3 font-bold text-[#02042B]">
                      {c.action_type}
                      {c.is_selected && <span className="ml-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Selected</span>}
                    </td>
                    <td className="px-5 py-3">{(c.probability * 100).toFixed(1)}%</td>
                    <td className="px-5 py-3 font-bold text-blue-600">{c.uplift > 0 ? `+${(c.uplift * 100).toFixed(1)}%` : '—'}</td>
                    <td className="px-5 py-3">₹{c.action_cost}</td>
                    <td className="px-5 py-3 font-bold">{c.net_incremental_value > 0 ? <span className="text-green-600">₹{c.net_incremental_value?.toFixed(2)}</span> : c.action_type === 'NO_ACTION' ? 'Baseline' : `₹${c.net_incremental_value?.toFixed(2)}`}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                        c.policy_status === 'ALLOW' ? 'bg-green-100 text-green-700' :
                        c.policy_status === 'BLOCK' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {c.policy_status === 'ALLOW' ? <CheckCircle2 className="w-3 h-3" /> : c.policy_status === 'BLOCK' ? <XCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {c.policy_status}
                      </span>
                      {c.policy_reason && c.policy_reason !== "POLICY_CHECKS_PASSED" && c.policy_reason !== "Baseline action" &&
                        <p className="text-[10px] text-red-500 mt-0.5">{c.policy_reason}</p>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#8B94A7] text-center">{result.label}</p>
        </>
      )}
    </div>
  );
}
