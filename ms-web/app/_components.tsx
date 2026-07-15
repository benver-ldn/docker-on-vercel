import type { Rating } from "@/lib/types";

export function StockBadge({ stock }: { stock: number | null }) {
  if (stock === null) return <span className="text-xs text-gray-400">stock unavailable</span>;
  if (stock === 0) return <span className="text-xs font-medium text-red-600">Out of stock</span>;
  return <span className="text-xs font-medium text-green-600">{stock} in stock</span>;
}

export function Stars({ rating }: { rating: Rating | null }) {
  if (rating === null) return <span className="text-xs text-gray-400">no rating</span>;
  const full = Math.round(rating.avg);
  return (
    <span className="text-xs text-amber-500">
      {"★".repeat(full)}
      <span className="text-gray-300">{"★".repeat(5 - full)}</span>
      <span className="ml-1 text-gray-500">
        {rating.avg.toFixed(1)} ({rating.count})
      </span>
    </span>
  );
}
