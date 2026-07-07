# nextjs-docker

A minimal **Next.js** (App Router) app, packaged in Docker with `output: 'standalone'`, proving a
Dockerized Next.js app runs as a container-runtime **Vercel Function**. This deliberately uses the
container path (not Next.js's native Vercel deployment) to test the container runtime with a
Node workload.

## Routes

| Route | Method | Response |
| ----- | ------ | -------- |
| `/` | GET | Server-rendered page showing the live Node version / region |
| `/api/echo` | GET | `{ "status":"ok", "runtime":"nextjs", "nodeVersion":"…", "message":"…" }` |
| `/api/echo` | POST | `{ "ok":true, "received": <the JSON you sent> }` |

The container listens on port **80**, bound to `0.0.0.0` (`HOSTNAME=0.0.0.0`).

## Requirements

- **Docker** for local build/run.
- **Vercel CLI**, authenticated, on a team with **Container Images** access (to deploy).

## Build & run locally

```bash
docker build -f Dockerfile.vercel -t nextjs-docker .
docker run --rm -p 8080:80 nextjs-docker
# then:
./smoke-test.sh http://localhost:8080
# or open http://localhost:8080 in a browser
```

## Deploy to Vercel

Deploy this folder as its **own** Vercel project (Root Directory = this folder):

```bash
vercel deploy          # preview URL
./smoke-test.sh <preview-url>
vercel deploy --prod   # optional
```

`vercel.json` declares the container service (`runtime: container`, `entrypoint: Dockerfile.vercel`)
and routes all traffic to it. Vercel builds the image, pushes it to the Vercel Container Registry,
and runs it as a container function that scales to zero when idle.
