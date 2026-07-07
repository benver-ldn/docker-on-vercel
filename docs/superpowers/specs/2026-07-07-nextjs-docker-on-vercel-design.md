# Dockerized Next.js on a Vercel container function — POC design

**Date:** 2026-07-07
**Status:** Approved (design)
**Author:** brainstormed with Claude Code

## Goal

Prove that a **Next.js** app, packaged as a Docker image, runs as a **container-runtime Vercel
Function** — the Node-based counterpart to the `java-spring-boot/` experiment. Success = a
server-rendered page and an API route respond correctly both from a local Docker container and
from a deployed Vercel URL.

This deliberately uses the **container path** (`Dockerfile.vercel` + container runtime), NOT
Next.js's normal native Vercel deployment. Testing the container runtime with a Node/Next.js
workload is the entire point — especially as a contrast to the Java run, which failed at runtime
while an equivalent Node/Express container succeeded (see
`java-spring-boot/` and the memory note `spring-boot-vercel-container-blocked`).

## Non-goals

- Not replacing or modifying the root Node/Express demo or `java-spring-boot/`.
- Not the normal native Next.js deployment (`vercel deploy` of a plain Next.js app) — we want the container.
- No automated test suite (explicit decision, matching the Java POC). Verify via curl + browser.
- No database, auth, or app features beyond one page + one API route.

## Approach (isolated subfolder = its own Vercel project)

All new work lives under `nextjs-docker/`, deployed as its own Vercel project whose Root
Directory is that folder. Vercel builds `Dockerfile.vercel` and routes all traffic to the
container service via the `services` block in `vercel.json` (same pattern as the root demo).

## File layout

Everything new is under `nextjs-docker/`:

```
nextjs-docker/
├── Dockerfile.vercel                 # multi-stage: deps → build (standalone) → runner
├── .dockerignore
├── vercel.json                       # services block → container runtime; rewrite all → app
├── next.config.ts                    # output: 'standalone'
├── package.json                      # next, react, react-dom (Next.js 16)
├── tsconfig.json
├── next-env.d.ts
├── README.md                         # build / run / deploy / curl instructions
├── smoke-test.sh                     # curls the page and /api/echo against a base URL
└── app/
    ├── layout.tsx                    # minimal root layout
    ├── page.tsx                      # SSR page (server component)
    └── api/echo/route.ts             # GET status + POST echo
```

## Container (`Dockerfile.vercel`, multi-stage — official Next.js standalone pattern)

- **Stage 1 (deps):** `node:24-alpine` (+ `libc6-compat`). Copy `package.json`/lockfile, `npm ci` (or `npm install`).
- **Stage 2 (build):** copy deps + source, `npm run build`. With `output: 'standalone'` in
  `next.config.ts`, this emits a self-contained server at `.next/standalone`.
- **Stage 3 (runner):** slim `node:24-alpine`. Copy `.next/standalone`, `.next/static`, and
  `public`. `ENV PORT=80` and `ENV HOSTNAME=0.0.0.0`, `EXPOSE 80`, `CMD ["node", "server.js"]`.

The standalone `server.js` reads `PORT` and `HOSTNAME`. Binding `0.0.0.0` (IPv4) is deliberate —
the Java run failed because the JVM bound the IPv6 wildcard only and Vercel's runtime reached it
over IPv4. Node/Next.js binding `0.0.0.0` avoids that class of problem, and Node containers are
already proven to work on Vercel's container runtime.

Node version: `node:24-alpine` matches Vercel's current default. If an alpine/Next incompatibility
appears at build time, fall back to `node:22-alpine`.

## Port & lifecycle

- `PORT=80` (Vercel's default container port), `HOSTNAME=0.0.0.0` (IPv4 all-interfaces).
- Next.js standalone server binds `HOSTNAME:PORT` → `0.0.0.0:80`.
- Vercel routes container-function traffic to port 80; idle instances scale to zero.

## Page and API route

| Route | Method | Response |
| ----- | ------ | -------- |
| `/` | GET | Server-rendered HTML page: "Next.js in Docker on Vercel", showing the live `process.version` (Node) and `process.env.VERCEL_REGION` if present — proof it executes in the container. |
| `/api/echo` | GET | `{ "status":"ok", "runtime":"nextjs", "nodeVersion": process.version, "message":"Hello from Next.js on Vercel" }` |
| `/api/echo` | POST | Accepts JSON body; returns `{ "ok":true, "received": <body> }`. |

`app/page.tsx` is a server component (default in App Router), so rendering it exercises the
container's server runtime, not just static output.

## Data flow

Client → Vercel → container function (Next.js standalone Node server on `0.0.0.0:80`) → App
Router (SSR page or route handler) → HTML/JSON. First request cold-starts the Node server
(sub-second); idle → scale to zero.

## Verification plan (no automated tests)

1. **Local Docker:** `docker build -f Dockerfile.vercel -t nextjs-docker .` then
   `docker run --rm -p 8080:80 nextjs-docker`; open `http://localhost:8080/` and
   `./smoke-test.sh http://localhost:8080`.
2. **Deploy:** deploy `nextjs-docker/` as its own Vercel project (`vercel deploy`), then
   `./smoke-test.sh <url>` and open the page.

`smoke-test.sh` curls `GET /` (expects 200 + HTML containing "Next.js") and
`GET`/`POST /api/echo` (expects the runtime marker and echoed body).

## Decisions

- **Container path, not native Next.js deploy** — testing the container runtime is the goal.
- **`output: 'standalone'`** — the supported way to Dockerize Next.js; ships a minimal self-contained server.
- **Port 80 + `HOSTNAME=0.0.0.0`** — matches Vercel's default; IPv4 binding avoids the Java failure mode.
- **No automated tests** — POC, verified by curl + browser (matches the Java experiment).
- **`node:24-alpine`** base (fallback `node:22-alpine`), Next.js 16, App Router, TypeScript.
- **Own Vercel project** — isolated from the other two demos.

## Out of scope

- Native (non-container) Next.js deployment.
- Databases, auth, env secrets, multiple pages/routes.
- Image/cold-start optimization beyond the standalone output.
