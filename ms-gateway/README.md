# ms-gateway

Stateless Spring Boot API gateway. Fans out to catalog, inventory, and reviews and merges results.
Inventory/reviews are best-effort (10s timeout, null fallback); catalog is required.

## Endpoints
- `GET /health` → `{"status":"ok","service":"gateway"}`
- `GET /api/search?q=&category=` → enriched product array (`stock`/`rating` may be null)

## Config (env)
- `CATALOG_URL`, `INVENTORY_URL`, `REVIEWS_URL` — base URLs of the downstream services.

## Local (all four containers)
See plan Task 4, Step 7 — run catalog/inventory/reviews, then gateway with
`*_URL=http://host.docker.internal:<port>`, then `./smoke-test.sh http://localhost:8080`.
