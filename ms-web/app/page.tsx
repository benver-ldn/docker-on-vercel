import Link from "next/link";
import type { Product } from "@/lib/types";
import { StockBadge, Stars } from "@/app/_components";

const CATEGORIES = ["", "Electronics", "Home", "Sports"];

async function search(q: string, category: string): Promise<Product[]> {
  const base = process.env.GATEWAY_URL;
  if (!base) throw new Error("GATEWAY_URL is not set");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const res = await fetch(`${base}/api/search?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`gateway responded ${res.status}`);
  return res.json();
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q = "", category = "" } = await searchParams;
  let products: Product[] = [];
  let error: string | null = null;
  try {
    products = await search(q, category);
  } catch (e) {
    error = e instanceof Error ? e.message : "search failed";
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-3">
          Java microservices · Vercel
        </p>
        <h1 className="mt-3 text-title font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
          Product search
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
          One Next.js frontend calling a Spring Boot gateway that fans out to the catalog,
          inventory, and reviews services.
        </p>
      </header>

      <form className="mt-8 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center overflow-hidden rounded-control border border-rule bg-paper transition-colors focus-within:border-accent">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search products…"
            aria-label="Search products"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <span className="h-6 w-px bg-rule" aria-hidden />
          <select
            name="category"
            defaultValue={category}
            aria-label="Filter by category"
            className="bg-transparent py-3 pl-3 pr-2 text-sm text-ink-2 focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c || "all"} value={c}>
                {c || "All categories"}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-control bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-2 active:translate-y-px"
        >
          Search
        </button>
      </form>

      {error && (
        <p className="mt-8 rounded-control border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          Search failed: {error}
        </p>
      )}

      {!error && (
        <>
          <p className="mt-6 font-mono text-xs text-ink-3">
            {products.length} {products.length === 1 ? "result" : "results"}
            {q && ` for “${q}”`}
            {category && ` in ${category}`}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="group flex flex-col rounded-card border border-rule bg-paper p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-rule-2 hover:shadow-card"
              >
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-3">
                  {p.category}
                </p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <h2 className="text-base font-medium leading-snug text-ink transition-colors group-hover:text-accent [overflow-wrap:anywhere]">
                    {p.name}
                  </h2>
                  <span className="shrink-0 whitespace-nowrap font-mono text-sm font-medium text-ink">
                    ${p.price.toFixed(2)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">
                  {p.description}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-rule pt-3">
                  <StockBadge stock={p.stock} />
                  <Stars rating={p.rating} />
                </div>
              </Link>
            ))}
            {products.length === 0 && (
              <p className="text-sm text-ink-2">No products found.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
