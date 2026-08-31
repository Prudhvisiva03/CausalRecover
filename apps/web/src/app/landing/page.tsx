"use client";
import Link from "next/link";
import { ArrowRight, Activity, GitBranch } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAFBFC] font-sans selection:bg-[#3366FF]/20 selection:text-[#02042B] pb-20">
      
      {/* ─── MODERN GRID BACKGROUND (LIGHT THEME) ─── */}
      <div className="fixed inset-0 z-0 pointer-events-none flex justify-center">
        <div className="absolute top-0 w-full h-full bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_40%,transparent_100%)]"></div>
        {/* Soft top glow */}
        <div className="absolute top-[-10%] w-[60%] h-[40%] bg-[#3366FF] blur-[120px] opacity-[0.05] rounded-[100%]"></div>
      </div>

      {/* ─── FLOATING GLASS NAVBAR ─── */}
      <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6">
        <nav className="bg-white/80 backdrop-blur-lg border border-[#E4E6EA] rounded-full px-5 py-2.5 flex items-center justify-between w-full max-w-4xl shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#3366FF] rounded flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-[10px] tracking-tighter">CR</span>
            </div>
            <span className="font-bold text-sm text-[#02042B] tracking-tight">CausalRecover</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#concept" className="text-xs font-semibold text-[#515978] hover:text-[#3366FF] transition-colors">The Concept</a>
            <a href="#engine" className="text-xs font-semibold text-[#515978] hover:text-[#3366FF] transition-colors">Engine</a>
            <a href="#metrics" className="text-xs font-semibold text-[#515978] hover:text-[#3366FF] transition-colors">Metrics</a>
          </div>

          <Link href="/dashboard" className="flex items-center gap-2 bg-[#02042B] hover:bg-[#0a0d3b] text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-md">
            Dashboard <ArrowRight className="w-3 h-3" />
          </Link>
        </nav>
      </div>

      {/* ─── CENTERED HERO SECTION ─── */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-48 pb-20 text-center px-6">
        
        {/* Subtle Launch Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#3366FF]/20 bg-[#3366FF]/5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3366FF] animate-pulse"></span>
          <span className="text-xs font-bold text-[#3366FF]">Razorpay AI Buildathon Track 03</span>
        </div>

        {/* Ultra-tight Typography Header */}
        <h1 className="text-5xl md:text-7xl lg:text-[84px] font-extrabold tracking-[-0.03em] leading-[1.05] text-[#02042B] max-w-4xl mb-6">
          Recover revenue with <br className="hidden md:block" />
          <span className="text-[#3366FF]">causal intelligence.</span>
        </h1>

        <p className="text-lg md:text-xl text-[#515978] max-w-2xl font-medium tracking-tight mb-10 leading-relaxed">
          Stop optimizing for gross recovery. CausalRecover computes the exact intervention that creates the highest <strong className="text-[#02042B]">net incremental value</strong>, leaving natural recoveries untouched.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-[#3366FF] hover:bg-[#2852cc] text-white rounded-full text-sm font-bold transition-all shadow-[0_8px_20px_rgba(51,102,255,0.25)] hover:shadow-[0_12px_25px_rgba(51,102,255,0.35)] hover:-translate-y-0.5">
            Open Merchant Dashboard
          </Link>
          <a href="#concept" className="w-full sm:w-auto px-8 py-4 bg-white border border-[#E4E6EA] hover:border-[#CFD3D9] text-[#02042B] rounded-full text-sm font-bold transition-all shadow-sm">
            Explore Architecture
          </a>
        </div>
      </section>

      {/* ─── BENTO GRID UI (Light Theme SaaS) ─── */}
      <section id="concept" className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Bento Box 1: The Flaw */}
          <div className="md:col-span-2 bg-white border border-[#E4E6EA] rounded-[24px] p-8 lg:p-10 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] group hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
            <p className="text-xs font-extrabold tracking-widest uppercase text-[#FF424E] mb-3">The Industry Flaw</p>
            <h3 className="text-3xl font-extrabold text-[#02042B] tracking-tight mb-4">Optimizing for the inevitable.</h3>
            <p className="text-[#515978] text-base font-medium leading-relaxed max-w-md">
              Most AI recovery systems measure <code className="bg-[#F4F5F8] px-1.5 py-0.5 rounded text-[#02042B] border border-[#E4E6EA] mx-1">P(pay | action)</code>. 
              They spend resources nudging customers who were already going to pay, inflating success metrics while wasting merchant margins.
            </p>
          </div>

          {/* Bento Box 2: The Solution */}
          <div className="bg-white border border-[#E4E6EA] rounded-[24px] p-8 lg:p-10 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] group hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#3366FF]/10 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="w-10 h-10 bg-[#3366FF]/10 rounded-xl flex items-center justify-center mb-5 border border-[#3366FF]/20">
              <Activity className="w-5 h-5 text-[#3366FF]" />
            </div>
            <h3 className="text-2xl font-extrabold text-[#02042B] tracking-tight mb-3">True Incrementality</h3>
            <p className="text-[#515978] text-sm font-medium leading-relaxed">
              We isolate causal impact: <code className="block mt-3 bg-[#F4F5F8] p-2.5 rounded text-xs text-[#00D27A] border border-[#E4E6EA] font-bold">Uplift = P(pay|action) - P(pay|no_action)</code>
            </p>
          </div>

          {/* Bento Box 3: Terminal / Economic Engine */}
          <div className="md:col-span-3 bg-white border border-[#E4E6EA] rounded-[24px] overflow-hidden flex flex-col md:flex-row shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all">
            <div className="p-8 lg:p-12 flex-1 flex flex-col justify-center">
              <div className="w-12 h-12 rounded-xl bg-[#FAFBFC] border border-[#E4E6EA] flex items-center justify-center mb-6 shadow-sm">
                <GitBranch className="w-6 h-6 text-[#02042B]" />
              </div>
              <h3 className="text-3xl font-extrabold text-[#02042B] tracking-tight mb-4">The Economic Optimizer</h3>
              <p className="text-[#515978] text-base font-medium leading-relaxed max-w-sm mb-8">
                CausalRecover ranks every possible intervention by its net incremental financial value, ensuring no action is taken unless it justifies its cost.
              </p>
              <ul className="space-y-4">
                {[
                  "Deterministic policy guardrails (Cost/Consent limits)",
                  "LightGBM T-Learner uplift models",
                  "Treats NO_ACTION as a valid economic baseline"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-bold text-[#02042B]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3366FF] shadow-[0_0_5px_rgba(51,102,255,0.5)]"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Dark Code Visual (Contrast element inside light theme) */}
            <div className="flex-1 bg-[#02042B] p-8 md:p-10 font-mono text-[11px] sm:text-xs leading-loose text-[#8B94A7] overflow-x-auto relative shadow-inner">
              <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-[#02042B]/50 to-transparent pointer-events-none"></div>
              
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF424E]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#F5A623]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#00D27A]"></div>
              </div>

              <div className="text-white/30 mb-4">/* Causal Optimization Engine */</div>
              <div><span className="text-[#3366FF] font-bold">const</span> <span className="text-white">evaluateIntervention</span> = (payment) =&gt; {'{'}</div>
              <div className="pl-4">
                <span className="text-[#3366FF] font-bold">const</span> baseProb = model.predict(payment, <span className="text-[#00D27A]">'NO_ACTION'</span>);
              </div>
              <div className="pl-4 mt-2">
                <span className="text-[#3366FF] font-bold">return</span> actions.map(action =&gt; {'{'}
              </div>
              <div className="pl-8">
                <span className="text-[#3366FF] font-bold">const</span> actionProb = model.predict(payment, action);
              </div>
              <div className="pl-8">
                <span className="text-[#3366FF] font-bold">const</span> uplift = actionProb - baseProb;
              </div>
              <div className="pl-8 mt-2">
                <span className="text-[#3366FF] font-bold">const</span> netValue = (uplift * payment.amount) - action.cost;
              </div>
              <div className="pl-8 mt-2">
                <span className="text-[#3366FF] font-bold">return</span> {'{'} action, netValue {'}'};
              </div>
              <div className="pl-4">{'}'}).sort((a, b) =&gt; b.netValue - a.netValue);</div>
              <div>{'}'}</div>
              
              <div className="mt-8 p-3.5 rounded-lg bg-[#00D27A]/10 border border-[#00D27A]/30 text-[#00D27A] font-bold">
                &gt; Execution selected: ALTERNATIVE_PAYMENT_METHOD<br />
                &gt; Expected Incremental Net: ₹2,097.40
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 mt-20 border-t border-[#E4E6EA] px-6 py-12 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-tighter bg-[#3366FF] px-2 py-1 rounded">CR</span>
            <span className="text-xs text-[#02042B] font-bold">CausalRecover</span>
          </div>
          <p className="text-[11px] text-[#515978] uppercase tracking-widest font-bold">
            Razorpay AI Buildathon 2026 • Track 03
          </p>
        </div>
      </footer>
    </div>
  );
}
