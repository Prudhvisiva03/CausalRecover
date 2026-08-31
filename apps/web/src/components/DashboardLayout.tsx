"use client";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // If we are on the landing page, don't show the dashboard sidebar and header
  if (pathname === "/landing") {
    return <main className="bg-[#02042B] min-h-screen">{children}</main>;
  }

  // Otherwise, show the full dashboard layout
  return (
    <div className="min-h-screen flex bg-[#F4F5F8]">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        {/* Dashboard Header */}
        <header className="h-16 border-b border-[#E4E6EA] bg-white flex items-center px-8 justify-between sticky top-0 z-10 shadow-sm">
          <h1 className="text-sm font-semibold text-[#515978] tracking-tight">Merchant Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-[#515978] bg-[#F4F5F8] px-2.5 py-1 rounded">Razorpay Buildathon</span>
            <div className="w-8 h-8 rounded bg-[#02042B] flex items-center justify-center">
              <span className="text-xs font-bold text-white">P</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
