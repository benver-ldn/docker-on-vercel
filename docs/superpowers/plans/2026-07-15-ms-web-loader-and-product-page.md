# ms-web Loader + Single Product Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a `GET /api/product/{id}` endpoint to the gateway, and add a skeleton loader + a single-product page (with DRY extraction of shared types/components) to `ms-web`.

**Architecture:** Reuses the existing gateway fan-out for a single id. Frontend stays server-component + Next.js Suspense (`loading.tsx`); no client-side data fetching.

**Tech Stack:** Spring Boot 3.3.5 (gateway), Next.js App Router + TypeScript + Tailwind (ms-web).

## Global Constraints

- Gateway Dockerfile is unchanged (fast-start flags + absolute java path already present) — do NOT modify it.
- Enriched product shape (unchanged): `{id:int, name, category, price:number, description, stock:int|null, rating:{avg:number,count:int}|null}`.
- ms-web import alias: `@/*` maps to the project root (create-next-app `--no-src-dir`), so `@/lib/types` = `ms-web/lib/types.ts`, `@/app/_components` = `ms-web/app/_components.tsx`. Verify against `ms-web/tsconfig.json` before relying on it.
- All Java build/run via Docker (no local JVM). ms-web build/run via local Node.
- No changes to catalog/inventory/reviews.

---

## Task 1: gateway `GET /api/product/{id}`

**Files:**
- Modify: `ms-gateway/src/main/java/com/example/gateway/SearchController.java`
- Modify: `ms-gateway/smoke-test.sh`

**Interfaces:**
- Produces: `GET /api/product/{id}` → one `Enriched` JSON object, or HTTP 404 if the id is not in the catalog. Consumed by ms-web (Task 2).

- [ ] **Step 1: Add the failing smoke checks** — append to `ms-gateway/smoke-test.sh` before the final "All gateway smoke checks passed." echo:

```bash
echo "==> GET ${BASE_URL}/api/product/1"
P1="$(curl -fsS --max-time 30 "${BASE_URL}/api/product/1")"
echo "${P1}"
echo "${P1}" | grep -q '"id":1' && echo "${P1}" | grep -q '"stock":42' \
  && echo "PASS: product by id" || { echo "FAIL: product by id"; exit 1; }

echo "==> GET ${BASE_URL}/api/product/999 (expect 404)"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${BASE_URL}/api/product/999")"
[ "${CODE}" = "404" ] && echo "PASS: unknown product 404" || { echo "FAIL: expected 404, got ${CODE}"; exit 1; }
```

- [ ] **Step 2: Run the gateway smoke test to see the new checks fail** — bring up the 4-container stack (see the ms-gateway README / original Task 4 recipe: catalog 8081, inventory 8082, reviews 8083, gateway 8080 with the three `*_URL` env vars → host.docker.internal), then:

Run: `cd ms-gateway && ./smoke-test.sh`
Expected: existing checks PASS, new `product by id` check FAILS (`/api/product/1` → 404 because the endpoint doesn't exist yet). Leave the non-gateway containers running; you'll rebuild the gateway next.

- [ ] **Step 3: Add the endpoint + imports** — edit `SearchController.java`.

Add these imports after the existing `import org.springframework.web.bind.annotation.*;` line:

```java
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
```

Add this method immediately after the `search(...)` method (before `getStock`):

```java
    @GetMapping("/api/product/{id}")
    public Enriched product(@PathVariable int id) throws Exception {
        // catalog is REQUIRED — fetch the full list and find the id.
        String catalogBody = get(catalogUrl + "/products?q=", Duration.ofSeconds(10));
        List<Product> products = Arrays.asList(mapper.readValue(catalogBody, Product[].class));
        Product p = products.stream().filter(x -> x.id() == id).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "product " + id + " not found"));

        // inventory + reviews are BEST-EFFORT — null on failure.
        String key = String.valueOf(id);
        Integer stock = getStock(key).get(key);
        Rating rating = getRatings(key).get(key);
        return new Enriched(p.id(), p.name(), p.category(), p.price(), p.description(), stock, rating);
    }
```

- [ ] **Step 4: Rebuild the gateway image and restart its container**

```bash
cd ms-gateway
docker build -f Dockerfile.vercel -t ms-gateway .
docker rm -f ms-gateway
docker run --rm -d -p 8080:80 --name ms-gateway \
  -e CATALOG_URL=http://host.docker.internal:8081 \
  -e INVENTORY_URL=http://host.docker.internal:8082 \
  -e REVIEWS_URL=http://host.docker.internal:8083 \
  ms-gateway
sleep 8
```

(catalog/inventory/reviews from Step 2 should still be running.)

- [ ] **Step 5: Run the gateway smoke test — now all pass**

Run: `cd ms-gateway && ./smoke-test.sh`
Expected: `All gateway smoke checks passed.` including `PASS: product by id` and `PASS: unknown product 404`.

- [ ] **Step 6: Commit**

```bash
git add ms-gateway/src/main/java/com/example/gateway/SearchController.java ms-gateway/smoke-test.sh
git commit -m "feat(ms-gateway): add GET /api/product/{id} (enriched single product, 404 if unknown)"
```

Leave the 4-container stack running for Task 2's end-to-end test (or restart it there).

---

## Task 2: ms-web loader + product page + DRY extraction

**Files:**
- Create: `ms-web/lib/types.ts`
- Create: `ms-web/app/_components.tsx`
- Modify: `ms-web/app/page.tsx`
- Create: `ms-web/app/loading.tsx`
- Create: `ms-web/app/product/[id]/page.tsx`
- Create: `ms-web/app/product/[id]/loading.tsx`
- Create: `ms-web/app/not-found.tsx`

**Interfaces:**
- Consumes: gateway `GET /api/search` (existing) and `GET /api/product/{id}` (Task 1).

- [ ] **Step 1: Extract shared types** — create `ms-web/lib/types.ts`:

```ts
export type Rating = { avg: number; count: number };

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  stock: number | null;
  rating: Rating | null;
};
```

- [ ] **Step 2: Extract shared presentational components** — create `ms-web/app/_components.tsx`:

```tsx
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
```

- [ ] **Step 3: Rewrite `ms-web/app/page.tsx`** to use the shared modules and make cards link to the product page. Replace the ENTIRE file with:

```tsx
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
```

- [ ] **Step 4: Main-page loader** — create `ms-web/app/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Product Search</h1>
      <p className="mt-1 text-sm text-gray-500">
        Next.js → Spring Boot gateway → catalog + inventory + reviews microservices on Vercel.
      </p>
      <div className="mt-6 h-[42px] w-full max-w-md animate-pulse rounded-md bg-gray-100" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-4 w-12 rounded bg-gray-200" />
            </div>
            <div className="mt-2 h-3 w-20 rounded bg-gray-100" />
            <div className="mt-3 h-3 w-full rounded bg-gray-100" />
            <div className="mt-1 h-3 w-3/4 rounded bg-gray-100" />
            <div className="mt-4 flex items-center justify-between">
              <div className="h-3 w-16 rounded bg-gray-100" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Product detail page** — create `ms-web/app/product/[id]/page.tsx`:

```tsx
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
```

- [ ] **Step 6: Product detail loader** — create `ms-web/app/product/[id]/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
      <div className="mt-6 animate-pulse rounded-lg border border-gray-200 p-6">
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="h-7 w-48 rounded bg-gray-200" />
          <div className="h-6 w-16 rounded bg-gray-200" />
        </div>
        <div className="mt-4 h-3 w-full rounded bg-gray-100" />
        <div className="mt-1 h-3 w-2/3 rounded bg-gray-100" />
        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="h-3 w-16 rounded bg-gray-100" />
          <div className="h-3 w-20 rounded bg-gray-100" />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Not-found page** — create `ms-web/app/not-found.tsx`:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">Product not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        That product doesn’t exist in the catalog.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
      >
        ← Back to search
      </Link>
    </main>
  );
}
```

- [ ] **Step 8: Build** — `cd ms-web && npm run build`. Expected: build succeeds, no type errors (confirms the `@/*` imports resolve and the routes compile).

- [ ] **Step 9: End-to-end verification (curl, no browser).** Ensure the 4-container stack (with the rebuilt gateway from Task 1) is running, then run `GATEWAY_URL=http://localhost:8080 npm run start` (after the build) in the background and:

```bash
# product page renders the product
curl -s "http://localhost:3000/product/1" | grep -q "Wireless Headphones" && echo "PASS: product page" || echo "FAIL"
# unknown id → not-found page
curl -s "http://localhost:3000/product/999" | grep -q "Product not found" && echo "PASS: not-found" || echo "FAIL"
# main page cards link to /product/<id>
curl -s "http://localhost:3000/?q=keyboard" | grep -q 'href="/product/2"' && echo "PASS: card links" || echo "FAIL"
```

Stop the dev/start server when done. (The skeleton loaders are Suspense fallbacks — verified by the files existing + build success, not curl.)

- [ ] **Step 10: Commit**

```bash
git add ms-web/lib ms-web/app
git commit -m "feat(ms-web): skeleton loader + single product page; extract shared types/components"
```

---

## Task 3: Deploy + verify (controller-run)

- [ ] Redeploy gateway: `cd ms-gateway && vercel deploy --prod --yes`, then `./smoke-test.sh <gateway-prod-url>` (product checks pass on prod).
- [ ] Redeploy ms-web: `cd ms-web && vercel deploy --prod --yes`.
- [ ] Verify prod: `curl <web-url>/product/1` shows the product; `<web-url>/product/999` shows not-found; browser spot-check of the loader on a cold search.

## Self-review

- Spec coverage: gateway endpoint (Task 1), loader (Task 2 Step 4/6), product page (Step 5), not-found (Step 7), DRY extraction (Steps 1–3), deploy (Task 3) — all covered.
- Type consistency: `Product`/`Rating` in `lib/types.ts` match the gateway `Enriched` shape and both pages import them; `_components.tsx` imports `Rating` from the same module.
- No placeholders; every file's full contents given.
