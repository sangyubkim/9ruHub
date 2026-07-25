import Link from "next/link";

const links = [
  { href: "/", label: "홈" },
  { href: "/analytics", label: "수익분석" },
  { href: "/recommendations", label: "AI 추천" },
  { href: "/orders", label: "주문" },
  { href: "/shipments", label: "물류" },
  { href: "/drafts", label: "초안" },
  { href: "/drafts/new", label: "URL" },
  { href: "/drafts/import", label: "엑셀" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_#e8f3ff,_#f7f5f1_45%,_#eef2ea)] text-zinc-900">
      <header className="border-b border-zinc-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-sky-800/80">SOURCING HUB</p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
              구매대행 상품 자동화
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 transition hover:border-sky-500 hover:text-sky-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
