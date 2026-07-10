# Java Microservices on Vercel — Design

**Date:** 2026-07-10
**Status:** Approved (design), pending spec review
**Goal:** Prove a full microservice architecture — a Next.js frontend plus multiple
independently-deployed Spring Boot services — runs on Vercel container functions.

## Context

Prior work in this repo proved a **frameworkless plain-Java** HTTP server runs as a Vercel
container function (`java-plain/`). The root cause of earlier Spring Boot failures was identified
and fixed: **Vercel's container runtime does not honor the image `ENV PATH`**, so `eclipse-temurin`'s
`java` (installed at `/opt/java/openjdk/bin/`) must be invoked by **absolute path**. See memory
`spring-boot-vercel-container-blocked`.

This project extends that single-container proof to a **multi-service topology**: one Next.js app and
four Spring Boot services, each deployed as its own Vercel project (container), communicating over
server-to-server HTTP.

Full Spring Boot fat-jar under a Vercel container is **not yet confirmed end-to-end** (only the PATH
root cause was). De-risking this is milestone 1.

## Architecture

### Repo layout (monorepo; each folder = one Vercel project, Root Directory = folder)

```
docker-on-vercel/
├─ ms-web/            Next.js frontend      → Vercel project (Node)
├─ ms-gateway/        Spring Boot gateway   → Vercel project (container)
├─ ms-catalog/        Spring Boot catalog   → Vercel project (container)
├─ ms-inventory/      Spring Boot inventory → Vercel project (container)
└─ ms-reviews/        Spring Boot reviews   → Vercel project (container)
```

### Request flow

```
Browser
  → Next.js (server-side route handler — no browser CORS)
      → ms-gateway  GET /api/search?q=&category=
           ├─ ms-catalog   GET /products?q=&category=   (search/filter → list of products)
           ├─ ms-inventory GET /stock?ids=1,2,3         (stock qty per id)
           └─ ms-reviews   GET /ratings?ids=1,2,3       (avg rating + count per id)
      ← gateway merges into one enriched result array
```

- 5 independent Vercel deployments.
- Services locate each other via **environment variables**:
  - gateway: `CATALOG_URL`, `INVENTORY_URL`, `REVIEWS_URL`
  - ms-web: `GATEWAY_URL`
- Env wiring is a **manual two-pass** (deploy service → copy its prod URL → set on gateway →
  redeploy gateway). Accepted for a demo; documented in each README.
- Each Spring Boot service reuses the proven container pattern: 2-stage `Dockerfile.vercel`,
  `java` by absolute path, bind `0.0.0.0:$PORT` (Vercel routes to port 80).

### Resilience

The gateway fan-out is resilient: each downstream call has a generous timeout (~10s, to tolerate
cold JVMs) and a fallback. If inventory or reviews is cold/down, the product is still returned with
`stock: null` / `rating: null`, and the UI shows "unavailable" rather than failing the whole search.
This is the real microservice concern the demo showcases.

## Services & data

**Common stack:** Java 21, Spring Boot 3.x (single pinned version across all four services), Maven,
one `@RestController` per service, data seeded in-memory at startup (database-per-service pattern).

**Base images (pinned, identical across all four):**
- build stage: `maven:3-eclipse-temurin-21`
- runtime stage: `eclipse-temurin:21-jre-alpine`
- run command: `/opt/java/openjdk/bin/java -jar app.jar` (absolute path)

| Service   | Owns (in-memory)                                        | Endpoints |
|-----------|--------------------------------------------------------|-----------|
| catalog   | 12 products (id, name, category, price, description) | `GET /products?q=&category=` → matching products; `GET /health` |
| inventory | stock count per product id                              | `GET /stock?ids=1,2,3` → `{ "1": 42, ... }`; `GET /health` |
| reviews   | avg rating + review count per product id               | `GET /ratings?ids=1,2,3` → `{ "1": {"avg":4.3,"count":128}, ... }`; `GET /health` |
| gateway   | nothing (stateless aggregator)                         | `GET /api/search?q=&category=` → enriched products; `GET /health` |

**Shared product IDs:** all three data services hardcode the same product ID range (1–12). This is
the honest microservice reality (each service owns its slice keyed by a shared business id); the
merge in the gateway joins on `id`.

**Enriched result shape** (gateway output → what Next.js renders):

```json
{
  "id": 1,
  "name": "…",
  "category": "…",
  "price": 19.99,
  "description": "…",
  "stock": 42,
  "rating": { "avg": 4.3, "count": 128 }
}
```

`stock` and `rating` are `null` when the corresponding downstream is unavailable.

### Frontend (ms-web)

- Next.js (App Router), TypeScript, Tailwind, shadcn/ui.
- Single search page: search box + category filter.
- Server-side route handler (or server action) calls `GATEWAY_URL/api/search` — keeps the gateway
  URL server-side and avoids browser CORS.
- Renders a grid of product cards: name, price, stock badge, rating stars.
- Graceful "stock unavailable" / "no rating" when those fields are null.

## Testing

This is a deployment-proof demo, not a product — favor smoke tests + one manual end-to-end pass over
a heavy unit-test suite.

- Each Spring Boot service ships a `smoke-test.sh` (like `java-plain/`) that hits its endpoints
  against a local Docker run.
- Gateway: local test with all three services running in Docker — assert (a) correct merge and
  (b) fallback when one downstream is stopped.
- ms-web: verify the page renders results against a live gateway URL.

## Build & deploy order

1. **`ms-catalog`** → deploy to Vercel, smoke-test the live URL. **Gate:** confirms full Spring Boot
   fat-jar runs on a Vercel container. Do not proceed until green.
2. **`ms-inventory`**, **`ms-reviews`** → deploy, smoke-test.
3. **`ms-gateway`** → set `CATALOG_URL` / `INVENTORY_URL` / `REVIEWS_URL` to the three prod URLs →
   deploy → test aggregation + fallback.
4. **`ms-web`** → set `GATEWAY_URL` → deploy → end-to-end test in browser.

## Scope guard (YAGNI — explicitly out of scope)

- No auth, no persistence (data resets on cold start — fine for a demo).
- No service discovery/registry, no message queue/event bus.
- No observability beyond Vercel's built-in logs.
- No autoscaling/min-instance tuning (services scale to zero; cold starts accepted and framed as a
  talking point).

## Known trade-offs

- **Cold starts:** first search after idle fans out to cold JVMs → possibly several seconds.
  Mitigated by generous gateway timeouts; framed as a scale-to-zero talking point.
- **Manual env wiring** across independent Vercel projects (two-pass deploy). Documented, not
  automated.
- **Seed drift risk:** the three data services independently hardcode IDs 1–12; they must stay in
  sync. Kept simple deliberately (no shared seed module).
