import type { Metadata } from "next";
import "./globals.css";
import DashboardLayout from "@/components/DashboardLayout";

export const metadata: Metadata = {
  title: "CausalRecover — AI Revenue Recovery Intelligence",
  description: "Incrementality-aware AI Revenue Recovery for Razorpay AI Buildathon",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-[#02042B] font-sans antialiased bg-[#F4F5F8]">
        <DashboardLayout>{children}</DashboardLayout>
      </body>
    </html>
  );
}
