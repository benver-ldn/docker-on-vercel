# java-plain

A **frameworkless** Java HTTP server (JDK `com.sun.net.httpserver.HttpServer`, no Spring, no
Tomcat, no build tool, zero dependencies), packaged in Docker, as a diagnostic to test whether a
plain-Java container runs as a Vercel container function where the Spring Boot POC failed.

## Endpoints

| Route | Method | Response |
| ----- | ------ | -------- |
| `/` | GET | `{ "status":"ok", "runtime":"java-httpserver", "javaVersion":"…", "message":"…" }` |
| `/echo` | POST | `{ "ok":true, "received":"<request body, JSON-escaped>" }` |

The server binds **`0.0.0.0:80`** (IPv4) — `PORT` env overrides the port.

## Requirements

- **Docker** for local build/run.
- **Vercel CLI**, authenticated, on a team with **Container Images** access (to deploy).

## Build & run locally

```bash
docker build -f Dockerfile.vercel -t java-plain .
docker run --rm -p 8080:80 java-plain
# then:
./smoke-test.sh http://localhost:8080
```

## Deploy to Vercel

Deploy this folder as its **own** Vercel project (Root Directory = this folder):

```bash
vercel deploy          # preview URL
./smoke-test.sh <preview-url>
vercel deploy --prod   # optional
```

`vercel.json` declares the container service and routes all traffic to it. Vercel builds the
image, pushes it to the Vercel Container Registry, and runs it as a container function that scales
to zero when idle.
