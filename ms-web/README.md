# ms-web

Next.js (App Router) frontend for the microservices demo. Server-side calls the gateway.

## Config (env)
- `GATEWAY_URL` — base URL of ms-gateway (e.g. http://localhost:8080 locally).

## Local
Bring up the four Spring Boot containers (see ms-gateway README), set `GATEWAY_URL`
in `.env.local`, then:
    npm install
    npm run dev   # http://localhost:3000
