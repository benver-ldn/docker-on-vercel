import type { Rating } from "@/lib/types";

export function StockBadge({ stock }: { stock: number | null }) {
  if (stock === null)
    return <span className="font-mono text-xs text-ink-3">stock&nbsp;—</span>;
  if (stock === 0)
    return <span className="font-mono text-xs font-medium text-warn">out of stock</span>;
  return <span className="font-mono text-xs font-medium text-ok">{stock} in stock</span>;
}

export function Stars({ rating }: { rating: Rating | null }) {
  if (rating === null) return <span className="font-mono text-xs text-ink-3">no rating</span>;
  const full = Math.max(0, Math.min(5, Math.round(rating.avg)));
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="tracking-tight text-star" aria-hidden>
        {"★".repeat(full)}
        <span className="text-rule-2">{"★".repeat(5 - full)}</span>
      </span>
      <span className="font-mono text-ink-3">
        {rating.avg.toFixed(1)} · {rating.count}
      </span>
    </span>
  );
}
