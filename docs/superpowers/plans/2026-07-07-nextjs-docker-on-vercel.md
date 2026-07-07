# Dockerized Next.js on Vercel Container Function — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove a Next.js app, packaged as a Docker image with `output: 'standalone'`, runs as a container-runtime Vercel Function serving a server-rendered page and a GET/POST API route.

**Architecture:** A minimal Next.js 16 App Router app lives in a new `nextjs-docker/` subfolder. A multi-stage `Dockerfile.vercel` (deps → build → standalone runner) produces a slim Node image that listens on port 80 / `0.0.0.0`. Vercel builds it and routes all traffic to the container service via `vercel.json`. Deployed as its own Vercel project, isolated from the root Node demo and `java-spring-boot/`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Node.js 24 (alpine), Docker (multi-stage), Vercel Functions container runtime.

## Global Constraints

- **All new files live under `nextjs-docker/`.** Do NOT modify the repo root or `java-spring-boot/`.
- **Next.js 16, App Router, TypeScript, React 19.** `output: 'standalone'` set in `next.config.ts`.
- **Container listens on port 80, bound to `0.0.0.0` (IPv4):** `ENV PORT=80` and `ENV HOSTNAME=0.0.0.0` in the runner stage. (The Java POC failed because its server bound the IPv6 wildcard only; Node/Next.js binding `0.0.0.0` avoids that.)
- **Multi-stage Dockerfile on `node:24-alpine`** (+ `libc6-compat`). If an alpine/Next incompatibility appears at build time, fall back to `node:22-alpine`.
- **No automated test suite** (explicit decision). Verify via `docker build`/`run`, `curl`, browser, and `smoke-test.sh`.
- **Deployed as its own Vercel project** (Root Directory = `nextjs-docker/`).
- **Prerequisites:** Docker daemon running locally for build/test; for deploy, Vercel CLI authenticated + team has **Container Images** access.
- **Git:** work on branch `nextjs-docker-poc` (already created off `main`). Never commit to `main`. Commit after each task. Footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Next.js app source + config

Create a minimal, buildable Next.js App Router app. Verification builds it inside a Node container (no reliance on a specific local Node/npm setup).

**Files:**
- Create: `nextjs-docker/package.json`
- Create: `nextjs-docker/next.config.ts`
- Create: `nextjs-docker/tsconfig.json`
- Create: `nextjs-docker/next-env.d.ts`
- Create: `nextjs-docker/.gitignore`
- Create: `nextjs-docker/app/layout.tsx`
- Create: `nextjs-docker/app/page.tsx`
- Create: `nextjs-docker/app/api/echo/route.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a Next.js app that `npm run build` compiles into `.next/standalone/server.js`. HTTP surface: `GET /` (SSR HTML containing "Next.js"); `GET /api/echo` → JSON `{status, runtime:"nextjs", nodeVersion, message}`; `POST /api/echo` → JSON `{ok, received}`. Server reads `PORT` and `HOSTNAME` at runtime (via the standalone server).

- [ ] **Step 1: Create `nextjs-docker/package.json`**

```json
{
  "name": "nextjs-docker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

- [ ] **Step 2: Create `nextjs-docker/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone) for a slim Docker runtime image.
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 3: Create `nextjs-docker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `nextjs-docker/next-env.d.ts`**

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 5: Create `nextjs-docker/.gitignore`**

```gitignore
node_modules/
.next/
.vercel/
*.tsbuildinfo
```

- [ ] **Step 6: Create `nextjs-docker/app/layout.tsx`**

```tsx
export const metadata = {
  title: "Next.js in Docker on Vercel",
  description: "Dockerized Next.js running as a Vercel container function",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create `nextjs-docker/app/page.tsx`**

```tsx
// Force dynamic rendering so this executes in the container at request time
// (proves the server runtime, not a static prerender).
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", lineHeight: 1.6 }}>
      <h1>Next.js in Docker on Vercel ▲</h1>
      <p>This page is server-rendered inside a Docker container running as a Vercel Function.</p>
      <ul>
        <li>Runtime: Next.js (App Router)</li>
        <li>Node: {process.version}</li>
        <li>Region: {process.env.VERCEL_REGION ?? "local"}</li>
      </ul>
      <p>
        API: <code>GET /api/echo</code> and <code>POST /api/echo</code>
      </p>
    </main>
  );
}
```

- [ ] **Step 8: Create `nextjs-docker/app/api/echo/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

// Run on the Node.js server runtime inside the container.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    runtime: "nextjs",
    nodeVersion: process.version,
    message: "Hello from Next.js on Vercel",
  });
}

export async function POST(req: NextRequest) {
  let received: unknown = null;
  try {
    received = await req.json();
  } catch {
    received = null;
  }
  return NextResponse.json({ ok: true, received });
}
```

- [ ] **Step 9: Verify the app builds and produces the standalone server (inside a Node container — no reliance on local Node)**

Run:
```bash
cd nextjs-docker
docker run --rm -v "$PWD":/app -w /app node:24-alpine \
  sh -c "apk add --no-cache libc6-compat >/dev/null 2>&1 && npm install && npm run build"
ls .next/standalone/server.js
```
Expected: `npm install` succeeds, `next build` finishes with a route summary listing `/` and `/api/echo`, and `ls` shows `.next/standalone/server.js` exists.
If the build fails on `node:24-alpine`, retry with `node:22-alpine` (and use `node:22-alpine` in the Dockerfile in Task 2).

- [ ] **Step 10: Commit**

```bash
cd ..
git add nextjs-docker/package.json nextjs-docker/next.config.ts nextjs-docker/tsconfig.json \
  nextjs-docker/next-env.d.ts nextjs-docker/.gitignore nextjs-docker/app
git commit -m "feat(nextjs-poc): scaffold Next.js app (page + echo API, standalone output)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Multi-stage `Dockerfile.vercel` + `.dockerignore`

Package the app into an OCI image and verify it serves the page and API locally.

**Files:**
- Create: `nextjs-docker/Dockerfile.vercel`
- Create: `nextjs-docker/.dockerignore`

**Interfaces:**
- Consumes: the Next.js app from Task 1 (`npm run build` → `.next/standalone`).
- Produces: a runnable image tagged `nextjs-docker` whose container listens on `0.0.0.0:80` and serves `/`, `/api/echo`.

- [ ] **Step 1: Create `nextjs-docker/Dockerfile.vercel`**

```dockerfile
# ---- Stage 1: install dependencies ----
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json ./
RUN npm install

# ---- Stage 2: build the standalone server ----
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Stage 3: slim runtime (standalone output) ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Vercel routes container-function traffic to port 80 by default.
ENV PORT=80
# Bind IPv4 all-interfaces (the JVM POC failed binding IPv6-only).
ENV HOSTNAME=0.0.0.0

# .next/standalone bundles server.js and the minimal node_modules it needs.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 80
CMD ["node", "server.js"]
```

- [ ] **Step 2: Create `nextjs-docker/.dockerignore`**

```dockerignore
node_modules
.next
.git
.vercel
*.md
npm-debug.log
```

- [ ] **Step 3: Build the image**

Run:
```bash
cd nextjs-docker
docker build -f Dockerfile.vercel -t nextjs-docker .
```
Expected: build completes through all three stages and tags `nextjs-docker`. (If it fails on `node:24-alpine`, switch all three `FROM node:24-alpine` lines to `node:22-alpine` and rebuild.)

- [ ] **Step 4: Run the container and verify the page + API by hand**

Run (map host 8080 → container 80):
```bash
docker run -d --rm -p 8080:80 --name nextjs-docker nextjs-docker
sleep 3
curl -fsS http://localhost:8080/ | grep -o "Next.js in Docker on Vercel ▲" ; echo
curl -fsS http://localhost:8080/api/echo ; echo
curl -fsS -X POST http://localhost:8080/api/echo -H 'Content-Type: application/json' -d '{"hi":1}' ; echo
docker stop nextjs-docker
```
Expected:
- `GET /` → HTML containing `Next.js in Docker on Vercel ▲`
- `GET /api/echo` → `{"status":"ok","runtime":"nextjs","nodeVersion":"v...","message":"Hello from Next.js on Vercel"}`
- `POST /api/echo` → `{"ok":true,"received":{"hi":1}}`

- [ ] **Step 5: Confirm the server binds IPv4 (0.0.0.0:80), applying the Java lesson**

Run:
```bash
docker run -d --rm -p 8080:80 --name nextjs-docker nextjs-docker
sleep 3
echo "IPv4 listeners:" && docker exec nextjs-docker sh -c 'cat /proc/net/tcp 2>/dev/null | awk "\$4==\"0A\"{print \$2}"'
docker stop nextjs-docker
```
Expected: an IPv4 listener on port 80 appears — `00000000:0050` (i.e. `0.0.0.0:80`).

- [ ] **Step 6: Commit**

```bash
cd ..
git add nextjs-docker/Dockerfile.vercel nextjs-docker/.dockerignore
git commit -m "feat(nextjs-poc): add multi-stage Dockerfile.vercel (standalone runner on :80)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `vercel.json` + `smoke-test.sh` + `README.md`

Add the container-runtime routing config, a reusable smoke test, and docs.

**Files:**
- Create: `nextjs-docker/vercel.json`
- Create: `nextjs-docker/smoke-test.sh`
- Create: `nextjs-docker/README.md`

**Interfaces:**
- Consumes: a running instance (local container from Task 2, or a deployed URL from Task 4).
- Produces: `vercel.json` routing all traffic to the container service; `smoke-test.sh <base-url>` exits 0 and prints `All smoke checks passed.` when the page and API behave.

- [ ] **Step 1: Create `nextjs-docker/vercel.json`**

```json
{
  "services": {
    "app": {
      "root": "./",
      "runtime": "container",
      "entrypoint": "Dockerfile.vercel"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": { "service": "app" } }]
}
```

- [ ] **Step 2: Create `nextjs-docker/smoke-test.sh`**

```bash
#!/usr/bin/env bash
# Smoke test for the Next.js container.
# Usage: ./smoke-test.sh [base-url]   (default: http://localhost:8080)
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

echo "==> GET ${BASE_URL}/"
PAGE="$(curl -fsS --connect-timeout 5 --max-time 30 "${BASE_URL}/")"
if echo "${PAGE}" | grep -qi "Next.js"; then
  echo "PASS: home page rendered"
else
  echo "FAIL: home page missing 'Next.js' marker"; exit 1
fi

echo
echo "==> GET ${BASE_URL}/api/echo"
API="$(curl -fsS --connect-timeout 5 --max-time 30 "${BASE_URL}/api/echo")"
echo "${API}"
if echo "${API}" | grep -q '"runtime":"nextjs"'; then
  echo "PASS: GET /api/echo reports nextjs runtime"
else
  echo "FAIL: GET /api/echo"; exit 1
fi

echo
echo "==> POST ${BASE_URL}/api/echo"
POST="$(curl -fsS --connect-timeout 5 --max-time 30 -X POST "${BASE_URL}/api/echo" \
  -H 'Content-Type: application/json' -d '{"hello":"vercel","n":1}')"
echo "${POST}"
if echo "${POST}" | grep -q '"hello":"vercel"' && echo "${POST}" | grep -q '"ok":true'; then
  echo "PASS: POST /api/echo echoed the body"
else
  echo "FAIL: POST /api/echo"; exit 1
fi

echo
echo "All smoke checks passed."
```

- [ ] **Step 3: Make it executable**

Run:
```bash
chmod +x nextjs-docker/smoke-test.sh
```
Expected: no output; the file gains the executable bit.

- [ ] **Step 4: Create `nextjs-docker/README.md`**

````markdown
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
````

- [ ] **Step 5: Verify the smoke test passes against a local container**

Run:
```bash
cd nextjs-docker
docker run -d --rm -p 8080:80 --name nextjs-docker nextjs-docker
sleep 3
./smoke-test.sh http://localhost:8080
docker stop nextjs-docker
```
Expected: the script prints all three `PASS:` lines and ends with `All smoke checks passed.` (exit 0).

- [ ] **Step 6: Commit**

```bash
cd ..
git add nextjs-docker/vercel.json nextjs-docker/smoke-test.sh nextjs-docker/README.md
git commit -m "docs(nextjs-poc): add vercel.json, smoke-test script, and README

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Deploy to Vercel and verify

Deploy the container function and confirm the page + API work on a real Vercel URL. Outward-facing — confirm with the user and ensure Vercel auth + Container Images access first.

**Files:** none created/modified (deployment only).

**Interfaces:**
- Consumes: the image definition (Tasks 1–2), `vercel.json`, and `smoke-test.sh` (Task 3).
- Produces: a deployed Vercel URL serving `/` and `/api/echo`.

- [ ] **Step 1: Confirm prerequisites**

Run:
```bash
vercel whoami
```
Expected: prints the logged-in user/team. If it errors, the user runs `! vercel login`. Confirm the target team has **Container Images** access.

- [ ] **Step 2: Deploy from inside the subfolder as its own project**

Run:
```bash
cd nextjs-docker
vercel deploy
```
When prompted, create a **new** project (accept the `nextjs-docker` directory as the project root). Vercel builds `Dockerfile.vercel`, pushes to VCR, and prints a URL.
Expected: a `https://<project>-<hash>-<team>.vercel.app` URL and a successful container build in the logs.

- [ ] **Step 3: Smoke-test the deployment**

Run (substitute the printed URL; if the project has Deployment Protection/SSO enabled, open it in an authenticated browser instead of curl):
```bash
./smoke-test.sh https://<deployment-url>
```
Expected: all three `PASS:` lines and `All smoke checks passed.` The first request may cold-start (sub-second for Node); re-run once if the very first call times out.

- [ ] **Step 4: (Optional) Record the live URL**

If you want the URL in the repo, add it to `nextjs-docker/README.md` under "Deploy to Vercel" and commit:
```bash
cd ..
git add nextjs-docker/README.md
git commit -m "docs(nextjs-poc): record deployed URL

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** isolated `nextjs-docker/` subfolder ✓ (Tasks 1–3); Next.js 16 App Router + TS + `output:'standalone'` ✓ (Task 1); multi-stage Docker on node:24-alpine → standalone runner ✓ (Task 2); port 80 + `HOSTNAME=0.0.0.0` IPv4 ✓ (Task 2, verified Step 5); SSR page + `GET`/`POST /api/echo` ✓ (Task 1); no automated tests, smoke-test instead ✓ (Task 3); own Vercel project deploy ✓ (Task 4); root demo + java-spring-boot untouched ✓ (Global Constraints). Container-path-not-native and no image optimization beyond standalone are respected (no task adds native deploy or extra tuning).

**Placeholder scan:** no TBD/TODO; every code step has complete file contents; the only runtime-substituted value is the deployed URL in Task 4.

**Type consistency:** API keys consistent across `route.ts` (`status`,`runtime:"nextjs"`,`nodeVersion`,`message` for GET; `ok`,`received` for POST), `smoke-test.sh` (greps `"runtime":"nextjs"`, `"hello":"vercel"`, `"ok":true`), and `README.md`. Page marker string `Next.js in Docker on Vercel ▲` matches between `app/page.tsx` and Task 2 Step 4's grep; `smoke-test.sh` greps the looser `Next.js` (present in both the marker and `<title>`). Port 80 / `0.0.0.0` consistent across `Dockerfile.vercel`, `docker run -p 8080:80`, and the IPv4 check.
