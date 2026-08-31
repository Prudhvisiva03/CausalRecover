"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, CreditCard, Smartphone, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const formatActionName = (action: string) => {
  if (!action) return "—";
  const map: Record<string, string> = {
    "ALTERNATIVE_PAYMENT_METHOD": "Alternative Payment",
    "CUSTOMER_NUDGE": "Customer Nudge",
    "RETRY_LATER": "Retry Later",
    "PAYMENT_LINK": "Payment Link",
    "UPDATE_PAYMENT_INSTRUMENT": "Update Instrument",
    "NO_ACTION": "No Action"
  };
  return map[action] || action.replace(/_/g, ' ');
};

const getStatusBadge = (status: string) => {
  if (status === 'RECOVERED') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00D27A]/10 text-[#00D27A] text-[11px] font-bold tracking-wide"><CheckCircle2 className="w-3 h-3" /> RECOVERED</span>;
  if (status === 'STOPPED') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[#515978] text-[11px] font-bold tracking-wide"><XCircle className="w-3 h-3" /> BLOCKED</span>;
  if (status === 'ESCALATED') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold tracking-wide"><AlertCircle className="w-3 h-3" /> ESCALATED</span>;
  
  // Default (Action Pending, Evaluating, Waiting, etc)
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3366FF]/10 text-[#3366FF] text-[11px] font-bold tracking-wide"><Clock className="w-3 h-3" /> {status?.replace(/_/g, ' ')}</span>;
};

export default function AtRiskPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [failureType, setFailureType] = useState("ALL");

  useEffect(() => {
    fetch(`${API}/api/payments/at-risk`)
      .then(r => r.json())
      .then(d => { setPayments(d.payments || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch = `${payment.id || ""} ${payment.customer_id || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesFailure = failureType === "ALL" || payment.failure_category === failureType;
    return matchesSearch && matchesFailure;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-[#02042B] tracking-tight">At-Risk Payments</h2>
          <p className="text-[#515978] mt-1 font-medium text-sm">{filteredPayments.length} failed payments requiring evaluation.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B94A7]" />
            <input 
              type="text" 
              placeholder="Search Payment ID..." 
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-[#E4E6EA] rounded-lg text-sm focus:outline-none focus:border-[#3366FF] focus:ring-1 focus:ring-[#3366FF] shadow-sm w-64 text-[#02042B]"
            />
          </div>
          <select value={failureType} onChange={(event) => setFailureType(event.target.value)} className="bg-white border border-[#E4E6EA] text-[#02042B] text-sm rounded-lg px-4 py-2 outline-none shadow-sm font-medium">
            <option value="ALL">All Failure Types</option>
            <option value="AUTHENTICATION_FAILED">Authentication Failed</option>
            <option value="INSUFFICIENT_FUNDS">Insufficient Funds</option>
            <option value="ISSUER_UNAVAILABLE">Issuer Unavailable</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-[#E4E6EA] shadow-sm">
          <div className="animate-pulse text-[#8B94A7] font-medium">Loading payments...</div>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E6EA] rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAFBFC] border-b border-[#E4E6EA] text-[#515978] font-bold text-[11px] uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Payment & Customer</th>
                <th className="px-6 py-4">Amount & Method</th>
                <th className="px-6 py-4">Failure Reason</th>
                <th className="px-6 py-4">Recovery Value</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EA]/50">
              {filteredPayments.map((p: any) => (
                <tr key={p.id} className="hover:bg-[#FAFBFC] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-mono text-[13px] font-semibold text-[#02042B] mb-1">
                      <span className="text-[#8B94A7]">pay_</span>{p.id.replace('pay_', '')}
                    </div>
                    <div className="text-xs text-[#515978] font-medium">
                      <span className="text-[#8B94A7]">cust_</span>{p.customer_id ? p.customer_id.replace('cust_', '') : 'not-provided'}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="font-bold text-[#02042B] text-sm mb-1">₹{p.amount?.toLocaleString('en-IN')}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#515978] font-bold uppercase tracking-wider">
                      {p.method?.toLowerCase() === 'upi' ? <Smartphone className="w-3 h-3 text-[#3366FF]" /> : <CreditCard className="w-3 h-3 text-[#515978]" />}
                      {p.method || 'unknown'}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <p className="max-w-[260px] whitespace-normal text-xs font-medium text-[#02042B]">{p.failure_reason || 'Provider did not provide a reason.'}</p>
                    <span className="mt-1 inline-flex items-center px-2 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded uppercase tracking-wider border border-red-100/50">
                      {p.failure_category?.replace(/_/g, ' ') || 'UNCLASSIFIED'}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm mb-1">
                      {p.best_action_net_value > 0 ? (
                        <span className="text-[#00D27A]">₹{p.best_action_net_value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span className="text-[10px] text-[#8B94A7] font-medium tracking-normal ml-1">net inc.</span></span>
                      ) : !p.best_action ? (
                        <span className="text-amber-700">Awaiting evaluation</span>
                      ) : (
                        <span className="text-[#8B94A7]">No Action Viable</span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-[#515978] flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3366FF]"></div>
                      {p.best_action ? formatActionName(p.best_action) : 'Decision pending'}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    {getStatusBadge(p.journey_status || 'EVALUATING')}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Link href={`/journeys/${p.id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#E4E6EA] text-[#02042B] group-hover:bg-[#3366FF] group-hover:text-white group-hover:border-[#3366FF] transition-all shadow-sm">
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
