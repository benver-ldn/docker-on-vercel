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
    <main className="mx-auto w-full max-w-2xl px-6 py-14 sm:py-20">
      <Link
        href="/"
        className="font-mono text-xs text-ink-3 transition-colors hover:text-accent"
      >
        ← Back to search
      </Link>

      {error && (
        <p className="mt-8 rounded-control border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          Failed to load product: {error}
        </p>
      )}

      {product && (
        <article className="mt-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-3">
            {product.category}
          </p>
          <div className="mt-3 flex items-start justify-between gap-6">
            <h1 className="text-display font-semibold leading-[1.05] tracking-tight text-ink [overflow-wrap:anywhere]">
              {product.name}
            </h1>
            <span className="shrink-0 whitespace-nowrap pt-2 font-mono text-lg font-medium text-ink">
              ${product.price.toFixed(2)}
            </span>
          </div>

          <p className="mt-5 max-w-prose text-[0.95rem] leading-relaxed text-ink-2">
            {product.description}
          </p>

          <dl className="mt-8 grid grid-cols-1 divide-y divide-rule overflow-hidden rounded-card border border-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="flex items-center justify-between gap-4 p-4">
              <dt className="font-mono text-xs uppercase tracking-wider text-ink-3">
                Availability
              </dt>
              <dd>
                <StockBadge stock={product.stock} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <dt className="font-mono text-xs uppercase tracking-wider text-ink-3">Rating</dt>
              <dd>
                <Stars rating={product.rating} />
              </dd>
            </div>
          </dl>
        </article>
      )}
    </main>
  );
}
