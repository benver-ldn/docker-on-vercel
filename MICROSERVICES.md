# Java Microservices on Vercel — Demo Runbook

A product-search demo proving a **full microservice architecture** — a Next.js frontend plus four
independently-deployed **Spring Boot** services — running on **Vercel container functions**.

## Live demo

| Surface | URL |
| ------- | --- |
| **Frontend (open this)** | https://ms-web-jade.vercel.app |
| Gateway API | https://ms-gateway-mu.vercel.app/api/search?q=headphones |
| catalog service | https://ms-catalog-seven.vercel.app/products?q=keyboard |
| inventory service | https://ms-inventory-sand.vercel.app/stock?ids=1,2,3 |
| reviews service | https://ms-reviews.vercel.app/ratings?ids=1,2,3 |

> All five are public (Deployment Protection disabled) so the demo is clickable. First request after
> idle is a cold start (~1–3s) — services scale to zero. That's a talking point, not a bug.

## Architecture

```
Browser
  → ms-web (Next.js, server-side fetch — no CORS)
      → ms-gateway  GET /api/search?q=&category=
           ├─ ms-catalog   GET /products?q=&category=   (search/filter — REQUIRED)
           ├─ ms-inventory GET /stock?ids=1,2,3          (stock — best-effort)
           └─ ms-reviews   GET /ratings?ids=1,2,3        (ratings — best-effort)
      ← gateway merges on product id → enriched array
```

- **5 independent Vercel projects**, one per folder (`ms-web`, `ms-gateway`, `ms-catalog`,
  `ms-inventory`, `ms-reviews`). Each Java service is its own Spring Boot app with its own in-memory
  data (database-per-service). Shared product IDs 1–12.
- **Resilient fan-out:** catalog is required (its failure fails the request); inventory and reviews
  are best-effort with a 10s timeout — if one is down, the product still returns with
  `stock: null` / `rating: null` and the UI shows "unavailable". (Verified locally by stopping
  `ms-reviews` and confirming the search still returns 200.)

## The two hard-won lessons (Java on Vercel containers)

Both are baked into every service's `Dockerfile.vercel`:

1. **Call java by absolute path.** Vercel's container runtime does not honor the image's `ENV PATH`;
   `eclipse-temurin` installs `java` at `/opt/java/openjdk/bin/`, so a bare `java` → `not found` →
   JVM never starts → `INTERNAL_FUNCTION_INVOCATION_FAILED` with no logs.
2. **JVM fast-start flags are required.** Default Spring Boot cold start (~7–10s) exceeds Vercel's
   container readiness window → every scale-from-zero request 500s (the app boots fine in the logs,
   but too slowly). `-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k
   -Dspring.main.lazy-initialization=true` cut startup to ~1s and fixed it.

```dockerfile
CMD ["/opt/java/openjdk/bin/java", \
     "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-Xss512k", \
     "-Dspring.main.lazy-initialization=true", "-Djava.net.preferIPv4Stack=true", \
     "-jar", "app.jar"]
```

Common stack: Java 21, Spring Boot 3.3.5, Maven fat jar, 2-stage Docker
(`maven:3-eclipse-temurin-21` build → `eclipse-temurin:21-jre-alpine` runtime), bind `0.0.0.0:$PORT`
(Vercel routes to port 80).

## Environment variable wiring (cross-project)

Each service is a separate project, so consumers find each other via env vars (set on the consumer's
Vercel project, production scope):

| Project | Env var | Value |
| ------- | ------- | ----- |
| `ms-gateway` | `CATALOG_URL` | `https://ms-catalog-seven.vercel.app` |
| `ms-gateway` | `INVENTORY_URL` | `https://ms-inventory-sand.vercel.app` |
| `ms-gateway` | `REVIEWS_URL` | `https://ms-reviews.vercel.app` |
| `ms-web` | `GATEWAY_URL` | `https://ms-gateway-mu.vercel.app` |

Locally the gateway defaults to `http://localhost:8081/8082/8083` and ms-web to
`http://localhost:8080`.

## Deploy runbook (order matters)

Each service deploys from its own folder as its own Vercel project. Downstreams first, so their URLs
exist before wiring consumers.

```bash
# 1. backend services (each: deploy, then disable Deployment Protection for a public demo)
cd ms-catalog   && vercel deploy --prod --yes && ./smoke-test.sh <catalog-url>
cd ../ms-inventory && vercel deploy --prod --yes && ./smoke-test.sh <inventory-url>
cd ../ms-reviews   && vercel deploy --prod --yes && ./smoke-test.sh <reviews-url>

# 2. gateway — wire the three downstream URLs, then deploy
cd ../ms-gateway && vercel link --yes
printf '%s' '<catalog-url>'   | vercel env add CATALOG_URL production
printf '%s' '<inventory-url>' | vercel env add INVENTORY_URL production
printf '%s' '<reviews-url>'   | vercel env add REVIEWS_URL production
vercel deploy --prod --yes && ./smoke-test.sh <gateway-url>

# 3. frontend — wire the gateway URL, then deploy
cd ../ms-web && vercel link --yes
printf '%s' '<gateway-url>' | vercel env add GATEWAY_URL production
vercel deploy --prod --yes
```

Deployment Protection (SSO) is on by default for new projects; this demo disables it on all five so
the site is publicly clickable and server-to-server calls work without bypass tokens. (Keep it on +
use `x-vercel-protection-bypass` headers if you need the services locked down.)

## Run the whole thing locally (Docker only — no local JVM needed)

```bash
docker build -f Dockerfile.vercel -t ms-catalog   ./ms-catalog
docker build -f Dockerfile.vercel -t ms-inventory ./ms-inventory
docker build -f Dockerfile.vercel -t ms-reviews   ./ms-reviews
docker build -f Dockerfile.vercel -t ms-gateway   ./ms-gateway

docker run --rm -d -p 8081:80 --name ms-catalog   ms-catalog
docker run --rm -d -p 8082:80 --name ms-inventory ms-inventory
docker run --rm -d -p 8083:80 --name ms-reviews   ms-reviews
docker run --rm -d -p 8080:80 --name ms-gateway \
  -e CATALOG_URL=http://host.docker.internal:8081 \
  -e INVENTORY_URL=http://host.docker.internal:8082 \
  -e REVIEWS_URL=http://host.docker.internal:8083 \
  ms-gateway

curl "http://localhost:8080/api/search?q=headphones"   # enriched result

cd ms-web && GATEWAY_URL=http://localhost:8080 npm run dev   # http://localhost:3000

docker stop ms-catalog ms-inventory ms-reviews ms-gateway
```

## Out of scope (YAGNI)

No auth, no persistence (in-memory, resets on cold start), no service discovery/registry, no message
queue, no observability beyond Vercel's built-in logs. This demo proves the topology, not a
production platform.

## Design & plan

- Spec: `docs/superpowers/specs/2026-07-10-java-microservices-on-vercel-design.md`
- Plan: `docs/superpowers/plans/2026-07-10-java-microservices-on-vercel.md`
