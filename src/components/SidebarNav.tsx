"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  /** exact match only (홈) */
  exact?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "시작",
    items: [{ href: "/", label: "대시보드", exact: true }],
  },
  {
    title: "발굴·가격",
    items: [
      { href: "/recommendations", label: "상품 발굴" },
      { href: "/ai-detail", label: "상세페이지" },
      { href: "/pricing", label: "판매가 계산" },
    ],
  },
  {
    title: "상품 등록",
    items: [
      { href: "/drafts", label: "초안 목록" },
      { href: "/drafts/new", label: "URL로 등록" },
      { href: "/drafts/import", label: "엑셀 가져오기" },
    ],
  },
  {
    title: "운영",
    items: [
      { href: "/orders", label: "주문 관리" },
      { href: "/shipments", label: "배송·물류" },
      { href: "/analytics", label: "수익·운영" },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/drafts") {
    return pathname === "/drafts" || pathname.startsWith("/drafts/");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** /drafts/new·import는 초안 목록보다 구체 경로가 우선 */
function resolveActiveHref(pathname: string): string | null {
  const flat = navGroups.flatMap((g) => g.items);
  const specific = flat
    .filter((item) => isActive(pathname, item))
    .sort((a, b) => b.href.length - a.href.length);
  return specific[0]?.href ?? null;
}

export function SidebarNav() {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname);
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-4" aria-label="주요 메뉴">
      {navGroups.map((group) => (
        <section
          key={group.title}
          className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3"
        >
          <h2 className="mb-2 border-b border-zinc-200/80 px-1 pb-2 text-sm font-semibold text-zinc-800">
            {group.title}
          </h2>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={
                      active
                        ? "block rounded-lg bg-white px-3 py-2 text-sm font-medium text-sky-900 shadow-sm ring-1 ring-sky-200"
                        : "block rounded-lg px-3 py-2 text-sm text-zinc-700 transition hover:bg-white hover:text-zinc-900"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/80 bg-white/80 px-4 py-3 lg:hidden">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-sky-800/80">
            SOURCING HUB
          </p>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
            구매대행 OS
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "닫기" : "메뉴"}
        </button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-900/30 lg:hidden"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="app-sidebar"
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200/80 bg-white/95 shadow-sm backdrop-blur transition-transform lg:static lg:z-0 lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="hidden border-b border-zinc-100 px-5 py-5 lg:block">
          <p className="text-[10px] tracking-[0.2em] text-sky-800/80">
            SOURCING HUB
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
            구매대행 OS
          </h1>
          <p className="mt-1 text-xs text-zinc-500">발굴 → 가격 → 등록 → 운영</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
      </aside>
    </>
  );
}
