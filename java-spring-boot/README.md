# java-spring-boot

A minimal Java **Spring Boot** HTTP server, packaged in Docker, proving a Spring Boot app can run
as a container-runtime **Vercel Function** — the Java counterpart to the Node/Express demo at the repo root.

## Endpoints

| Method | Path     | Response                                                                 |
| ------ | -------- | ------------------------------------------------------------------------ |
| GET    | `/`      | `{ "status":"ok", "runtime":"spring-boot", "javaVersion":"…", "message":"…" }` |
| POST   | `/echo`  | `{ "ok":true, "received": <the JSON you sent> }`                          |

The server listens on port **80** (`server.port=${PORT:80}`), matching Vercel's default container port.

## Requirements

- **Docker** (for local build/run). No local Java or Maven needed — the build runs inside the image.
- **Vercel CLI**, authenticated, on a team with **Container Images** access (to deploy).

## Build & run locally

```bash
docker build -f Dockerfile.vercel -t java-spring-demo .
docker run --rm -p 8080:80 java-spring-demo
# then, in another shell:
./smoke-test.sh http://localhost:8080
```

## Deploy to Vercel

Deploy this folder as its **own** Vercel project (Root Directory = this folder). From inside `java-spring-boot/`:

```bash
vercel deploy          # preview URL
./smoke-test.sh <preview-url>
vercel deploy --prod   # optional: promote to production
```

This folder includes a `vercel.json` that declares the container service (`runtime: container`,
`entrypoint: Dockerfile.vercel`) and routes all traffic to it. On deploy, Vercel builds the image,
pushes it to the Vercel Container Registry, and runs it as a container function that scales to zero
when idle.

## Quick manual test

```bash
curl http://localhost:8080/
curl -X POST http://localhost:8080/echo -H 'Content-Type: application/json' -d '{"hi":1}'
```

Note: `POST /echo` requires a `Content-Type: application/json` header — without it, Spring returns 415.
