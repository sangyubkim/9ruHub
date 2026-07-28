import { SidebarNav } from "@/components/SidebarNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_#e8f3ff,_#f7f5f1_45%,_#eef2ea)] text-zinc-900">
      <div className="flex min-h-full flex-col lg:flex-row">
        <SidebarNav />
        <div className="min-w-0 flex-1">
          <main className="mx-auto w-full max-w-[96rem] px-5 py-6 text-[15px] leading-relaxed sm:px-8 lg:px-10 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
