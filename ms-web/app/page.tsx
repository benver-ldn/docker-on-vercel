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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Product Search</h1>
      <p className="mt-1 text-sm text-gray-500">
        Next.js → Spring Boot gateway → catalog + inventory + reviews microservices on Vercel.
      </p>

      <form className="mt-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products…"
          aria-label="Search products"
          className="flex-1 min-w-[240px] rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          name="category"
          defaultValue={category}
          aria-label="Filter by category"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c || "all"} value={c}>
              {c || "All categories"}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Search failed: {error}
        </p>
      )}

      {!error && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="block rounded-lg border border-gray-200 p-4 transition hover:border-gray-400 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{p.name}</h2>
                <span className="whitespace-nowrap text-sm font-semibold">
                  ${p.price.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">{p.category}</p>
              <p className="mt-2 text-sm text-gray-600">{p.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <StockBadge stock={p.stock} />
                <Stars rating={p.rating} />
              </div>
            </Link>
          ))}
          {products.length === 0 && (
            <p className="text-sm text-gray-500">No products found.</p>
          )}
        </div>
      )}
    </main>
  );
}
