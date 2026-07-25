const COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  READY: "bg-sky-100 text-sky-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  PUBLISHING: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-indigo-100 text-indigo-800",
  REJECTED: "bg-rose-100 text-rose-800",
  ARCHIVED: "bg-stone-100 text-stone-600",
  LIVE: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  NOT_CREATED: "bg-zinc-100 text-zinc-600",
  PENDING: "bg-amber-100 text-amber-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  FALLBACK: "bg-amber-100 text-amber-800",
  SMARTSTORE: "bg-green-100 text-green-800",
  COUPANG: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status}
    </span>
  );
}
