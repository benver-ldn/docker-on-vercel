# ms-catalog

Spring Boot search/catalog microservice. Owns ~12 products in-memory.

## Endpoints
- `GET /health` → `{"status":"ok","service":"catalog"}`
- `GET /products?q=<text>&category=<cat>` → array of matching products

## Local (Docker only — no local JVM needed)
    docker build -f Dockerfile.vercel -t ms-catalog .
    docker run --rm -d -p 8081:80 --name ms-catalog ms-catalog
    ./smoke-test.sh http://localhost:8081
    docker stop ms-catalog

## Deploy
Deploy this folder as its own Vercel project (Root Directory = this folder):
    vercel deploy --prod
    ./smoke-test.sh <prod-url>
