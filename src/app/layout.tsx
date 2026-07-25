import type { Metadata } from "next";
import { Manrope, Fraunces } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sourcing Hub | 구매대행 상품 자동화",
  description: "Amazon US → 스마트스토어/쿠팡 초안 생성·승인·등록·동기화",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${sans.variable} ${display.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-sans)] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
