"use client";
import { useEffect, useState } from "react";
import { formatApiDate } from "@/utils/date";
import { CheckCircle2, XCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function IntegrationsPage() {
  const [razorpay, setRazorpay] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/integrations/razorpay/status`).then(r => r.json()).then(setRazorpay).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#02042B]">Integrations</h2>
        <p className="text-[#515978] mt-1">Payment provider and communication adapter connections.</p>
      </div>

      {/* Razorpay */}
      <div className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm overflow-hidden">
        <div className="p-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#02042B]">Razorpay</h3>
              <p className="text-sm text-[#515978]">Payment gateway integration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {razorpay?.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                <XCircle className="w-4 h-4" /> Not Connected
              </span>
            )}
          </div>
        </div>
        {razorpay && (
          <div className="px-6 pb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#F4F5F8] p-3 rounded-lg">
              <p className="text-xs text-[#515978]">Mode</p>
              <p className="font-bold text-amber-600">{razorpay.mode}</p>
            </div>
            <div className="bg-[#F4F5F8] p-3 rounded-lg">
              <p className="text-xs text-[#515978]">Total Webhooks</p>
              <p className="font-bold text-[#02042B]">{razorpay.total_webhooks}</p>
            </div>
            <div className="bg-[#F4F5F8] p-3 rounded-lg">
              <p className="text-xs text-[#515978]">Valid Signatures</p>
              <p className="font-bold text-green-600">{razorpay.valid_webhooks}</p>
            </div>
            <div className="bg-[#F4F5F8] p-3 rounded-lg">
              <p className="text-xs text-[#515978]">Signature validation</p>
              <p className={`font-bold text-xs ${razorpay.webhook_signature_required ? "text-green-600" : "text-amber-600"}`}>{razorpay.webhook_signature_required ? "Required" : "Not required"}</p>
            </div>
            <div className="bg-[#F4F5F8] p-3 rounded-lg">
              <p className="text-xs text-[#515978]">Last Webhook</p>
              <p className="font-bold text-[#02042B] text-xs">{razorpay.last_webhook ? formatApiDate(razorpay.last_webhook) : 'None'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Communication Adapters */}
      {[
        { name: "Email Adapter", desc: "Transactional email for recovery nudges", configured: razorpay?.communication_adapters?.email },
        { name: "SMS Adapter", desc: "SMS notifications for payment links", configured: razorpay?.communication_adapters?.sms },
        { name: "WhatsApp Adapter", desc: "WhatsApp Business for customer nudges", configured: razorpay?.communication_adapters?.whatsapp },
      ].map(adapter => (
        <div key={adapter.name} className="bg-white rounded-xl border border-[#E4E6EA] shadow-sm p-6 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#02042B]">{adapter.name}</h3>
            <p className="text-sm text-[#515978]">{adapter.desc}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${adapter.configured ? 'bg-green-100 text-green-700' : 'bg-[#F4F5F8] text-[#515978]'}`}>{adapter.configured ? "Configured" : "Not configured"}</span>
        </div>
      ))}
    </div>
  );
}
