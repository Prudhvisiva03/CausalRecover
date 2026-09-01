"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, AlertCircle, TrendingUp, Activity, ShieldCheck, BarChart3, ScrollText, FlaskConical, Brain, Plug, ListChecks } from "lucide-react";

const menu = [
  { label: "CORE", items: [
    { name: "Overview", href: "/", icon: LayoutDashboard },
  ]},
  { label: "RECOVERY", items: [
    { name: "At-Risk Payments", href: "/at-risk", icon: AlertCircle },
    { name: "Recovery Journeys", href: "/journeys", icon: TrendingUp },
  ]},
  { label: "INTELLIGENCE", items: [
    { name: "Decision Lab", href: "/lab", icon: Activity },
    { name: "Experiments", href: "/experiments", icon: FlaskConical },
    { name: "Models", href: "/models", icon: Brain },
  ]},
  { label: "OPERATIONS", items: [
    { name: "Action Queue", href: "/actions", icon: ListChecks },
    { name: "Audit Trail", href: "/audit", icon: ScrollText },
  ]},
  { label: "ANALYTICS", items: [
    { name: "Revenue Analytics", href: "/analytics", icon: BarChart3 },
  ]},
  { label: "CONFIGURATION", items: [
    { name: "Policies", href: "/policies", icon: ShieldCheck },
    { name: "Integrations", href: "/integrations", icon: Plug },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#02042B] border-r border-white/5 h-screen flex flex-col fixed left-0 top-0 overflow-y-auto">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-white/10 shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#3366FF] rounded flex items-center justify-center shadow-[0_0_10px_rgba(51,102,255,0.4)]">
            <span className="text-white font-bold text-sm">CR</span>
          </div>
          <div>
            <span className="font-semibold text-base text-white leading-none block tracking-tight">CausalRecover</span>
            <span className="text-[10px] text-[#3366FF] font-medium uppercase tracking-wider mt-0.5 block">AI Buildathon</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-6">
        {menu.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-bold text-[#515978] uppercase tracking-widest px-3 mb-2">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded transition-colors ${
                      isActive
                        ? "bg-[#3366FF]/10 text-[#3366FF]"
                        : "text-[#8B94A7] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="tracking-tight">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / Environment Badge */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#00D27A]/10 rounded border border-[#00D27A]/20">
          <div className="w-2 h-2 rounded-full bg-[#00D27A] animate-pulse shadow-[0_0_8px_#00D27A]"></div>
          <span className="text-xs font-medium text-[#00D27A]">Test Mode Active</span>
        </div>
      </div>
    </aside>
  );
}
