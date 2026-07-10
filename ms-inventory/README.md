# ms-inventory

Spring Boot inventory microservice. Owns stock levels (product id 1-12) in-memory.

## Endpoints
- `GET /health` → `{"status":"ok","service":"inventory"}`
- `GET /stock?ids=1,2,3` → `{"1":42,"2":0,...}`

## Local
    docker build -f Dockerfile.vercel -t ms-inventory .
    docker run --rm -d -p 8082:80 --name ms-inventory ms-inventory
    ./smoke-test.sh http://localhost:8082
    docker stop ms-inventory
