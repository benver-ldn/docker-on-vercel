# ms-reviews

Spring Boot reviews microservice. Owns avg rating + review count (product id 1-12) in-memory.

## Endpoints
- `GET /health` → `{"status":"ok","service":"reviews"}`
- `GET /ratings?ids=1,2,3` → `{"1":{"avg":4.5,"count":128},...}`

## Local
    docker build -f Dockerfile.vercel -t ms-reviews .
    docker run --rm -d -p 8083:80 --name ms-reviews ms-reviews
    ./smoke-test.sh http://localhost:8083
    docker stop ms-reviews
