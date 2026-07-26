import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Điều phối AI Agent — Training Marketing",
  description: "Giao task cho AI agent theo phòng ban, xem và duyệt kết quả.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="font-sans">
        <Sidebar />
        <main className="lg:pl-60">
          <div className="max-w-5xl mx-auto px-5 pb-10 pt-[72px] lg:pt-8 lg:px-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
