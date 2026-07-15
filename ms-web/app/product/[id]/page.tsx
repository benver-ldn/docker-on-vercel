import Link from "next/link";
import { notFound } from "next/navigation";
import type { Product } from "@/lib/types";
import { StockBadge, Stars } from "@/app/_components";

async function getProduct(id: string): Promise<Product | null> {
  const base = process.env.GATEWAY_URL;
  if (!base) throw new Error("GATEWAY_URL is not set");
  const res = await fetch(`${base}/api/product/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`gateway responded ${res.status}`);
  return res.json();
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let product: Product | null = null;
  let error: string | null = null;
  try {
    product = await getProduct(id);
  } catch (e) {
    error = e instanceof Error ? e.message : "failed to load product";
  }
  if (!error && product === null) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
        ← Back to search
      </Link>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load product: {error}
        </p>
      )}

      {product && (
        <article className="mt-6 rounded-lg border border-gray-200 p-6">
          <p className="text-xs uppercase tracking-wide text-gray-400">{product.category}</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <span className="whitespace-nowrap text-xl font-semibold">
              ${product.price.toFixed(2)}
            </span>
          </div>
          <p className="mt-4 text-sm text-gray-600">{product.description}</p>
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
            <StockBadge stock={product.stock} />
            <Stars rating={product.rating} />
          </div>
        </article>
      )}
    </main>
  );
}
