# ms-web Loader + Single Product Page — Design

**Date:** 2026-07-15
**Status:** Approved (design)
**Goal:** Add a loading state to the main search page and a single-product detail page to the
existing Java-microservices demo (`ms-web` + `ms-gateway`).

## Context

Extends the working demo (see `2026-07-10-java-microservices-on-vercel-design.md`). Currently
`ms-web` has one page: a server-component search grid calling `GATEWAY_URL/api/search`. Cold starts
make searches take a few seconds with no visual feedback, and products aren't clickable.

## Changes

### Backend — `ms-gateway` (one new endpoint)

`GET /api/product/{id}` → returns a single enriched product by id, or **404** if not found.
- Reuses the existing fan-out: fetch catalog product list, find the product whose `id` matches the
  path variable; if none, return 404. Otherwise call inventory + reviews for that id (best-effort,
  same 10s timeout + null fallback as `/api/search`) and return one `Enriched` object.
- Catalog/inventory/reviews are unchanged; the gateway filters the catalog list by id. Acceptable
  for a 12-product demo.
- Same enriched shape as search: `{id,name,category,price,description,stock:int|null,rating:{avg,count}|null}`.

### Frontend — `ms-web`

- **DRY extraction:** move the `Product`/`Rating` TS types to `lib/types.ts` and the presentational
  `StockBadge`/`Stars` components to `app/_components.tsx`; both the search page and the product page
  import them.
- **`app/loading.tsx`** — Suspense fallback for the main route: a grid of ~6 shimmering skeleton
  cards matching the real card layout (Tailwind `animate-pulse`). Shown automatically while the
  search server component awaits the gateway.
- **`app/product/[id]/page.tsx`** — server component, `params` awaited (Next 16), fetches
  `${GATEWAY_URL}/api/product/${id}` with `cache: "no-store"`. On non-2xx that is 404 → `notFound()`;
  on other errors → render an error message. Renders a detail view: name, category, price,
  description, stock badge, rating stars, and a "← Back to search" `Link`.
- **`app/product/[id]/loading.tsx`** — skeleton for the detail page (cold start applies here too).
- **`app/not-found.tsx`** — minimal "Product not found" page with a link back to search.
- **Main page:** wrap each product card in `<Link href={\`/product/${p.id}\`}>` so cards navigate to
  the detail page. Keep the existing grid/search/filter behavior otherwise.

## Testing

- **ms-gateway** `smoke-test.sh` gains: `GET /api/product/1` → contains `"id":1` + `"stock"`;
  `GET /api/product/999` → HTTP 404. Re-verified with the 4-container local stack.
- **ms-web** `npm run build` passes; curl `/product/1` HTML contains the product name + price;
  curl `/product/999` returns the not-found page. (Loader is a Suspense fallback — verified by
  presence of `loading.tsx`, not easily curl-tested.)
- Redeploy `ms-gateway` then `ms-web` to production; spot-check in browser.

## Scope guard (YAGNI)

No new data, no design-system overhaul, no client-side data fetching (stays server-component +
Suspense), no changes to catalog/inventory/reviews. Just the loader, the product route, and the
shared-code extraction.
