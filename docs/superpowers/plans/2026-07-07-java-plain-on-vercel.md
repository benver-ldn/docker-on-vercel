# Plain (frameworkless) Java on Vercel Container Function — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine whether a frameworkless Java HTTP server (JDK `com.sun.net.httpserver.HttpServer`, no Spring/Tomcat/build-tool) runs as a container-runtime Vercel Function — a diagnostic follow-up to the failing Spring Boot POC.

**Architecture:** A single `Main.java` using the JDK's built-in `HttpServer`, binding explicitly to IPv4 `0.0.0.0:80`, serving `GET /` and `POST /echo`. A 2-stage Docker build (`temurin:21-jdk-alpine` compiles with `javac` → `temurin:21-jre-alpine` runs the `.class`). Deployed as its own Vercel container project, isolated from the other demos.

**Tech Stack:** Java 21 (Eclipse Temurin, alpine), JDK `com.sun.net.httpserver`, Docker (2-stage), Vercel Functions container runtime. No frameworks, no dependencies, no build tool.

## Global Constraints

- **All new files live under `java-plain/`.** Do NOT modify the repo root, `java-spring-boot/`, or `nextjs-docker/`.
- **Frameworkless:** only the JDK's `com.sun.net.httpserver` — no Spring, no Tomcat, no Maven/Gradle, no dependencies, no JSON library.
- **Bind explicitly to IPv4:** `HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0)`; `port` from env `PORT`, default `80`. Runtime also passes `-Djava.net.preferIPv4Stack=true`.
- **2-stage Docker:** `eclipse-temurin:21-jdk-alpine` (javac) → `eclipse-temurin:21-jre-alpine` (run). Runs as root (binds privileged port 80).
- **No automated test suite** (explicit decision). Verify via `docker` + `curl` + browser + an IPv4-listener check.
- **Deployed as its own Vercel project** (Root Directory = `java-plain/`).
- **Prerequisites:** Docker daemon running for build/test; for deploy, Vercel CLI authenticated + team has **Container Images** access.
- **Git:** work on branch `java-plain-poc` (already created off `main`). Never commit to `main`. Commit after each task. Footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `Main.java` — frameworkless HTTP server

Create the single-file server and verify it compiles, runs, and serves — inside a JDK container (no local Java needed).

**Files:**
- Create: `java-plain/Main.java`
- Create: `java-plain/.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `Main.class` (via `javac Main.java`) with a `main` that starts `HttpServer` on `0.0.0.0:${PORT:-80}`. HTTP surface: `GET /` → JSON `{status, runtime:"java-httpserver", javaVersion, message}`; `POST /echo` → JSON `{ok:true, received:"<body>"}`; wrong method → `405`.

- [ ] **Step 1: Create `java-plain/Main.java`**

```java
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public class Main {

    public static void main(String[] args) throws IOException {
        int port = 80;
        String portEnv = System.getenv("PORT");
        if (portEnv != null && !portEnv.isBlank()) {
            port = Integer.parseInt(portEnv.trim());
        }

        // Bind explicitly to the IPv4 wildcard so Vercel's runtime can reach us.
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/", Main::handleRoot);
        server.createContext("/echo", Main::handleEcho);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        System.out.println("listening on 0.0.0.0:" + port);
    }

    private static void handleRoot(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }
        String javaVersion = System.getProperty("java.version");
        String body = "{\"status\":\"ok\",\"runtime\":\"java-httpserver\",\"javaVersion\":\""
                + jsonEscape(javaVersion)
                + "\",\"message\":\"Hello from plain Java on Vercel\"}";
        sendJson(exchange, 200, body);
    }

    private static void handleEcho(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }
        String received;
        try (InputStream in = exchange.getRequestBody()) {
            received = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        String body = "{\"ok\":true,\"received\":\"" + jsonEscape(received) + "\"}";
        sendJson(exchange, 200, body);
    }

    private static void sendJson(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    // Minimal JSON string escaping: backslash, quote, and control chars.
    private static String jsonEscape(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"': sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }
}
```

- [ ] **Step 2: Create `java-plain/.gitignore`**

```gitignore
*.class
.vercel/
```

- [ ] **Step 3: Verify it compiles, runs, and serves (inside a JDK container — no local Java needed)**

Run:
```bash
cd java-plain
docker rm -f jp-verify >/dev/null 2>&1 || true
docker run -d --rm -v "$PWD":/app -w /app -p 8080:80 -e PORT=80 --name jp-verify \
  eclipse-temurin:21-jdk-alpine sh -c "javac Main.java && java -Djava.net.preferIPv4Stack=true -cp . Main"
curl -fsS --retry 40 --retry-connrefused --retry-all-errors --retry-delay 1 --max-time 60 http://localhost:8080/ ; echo
curl -fsS --max-time 20 -X POST http://localhost:8080/echo -H 'Content-Type: application/json' -d '{"hi":1}' ; echo
docker stop jp-verify
```
Expected:
- `GET /` → `{"status":"ok","runtime":"java-httpserver","javaVersion":"21...","message":"Hello from plain Java on Vercel"}`
- `POST /echo` → `{"ok":true,"received":"{\"hi\":1}"}`
- (A `Main.class` file is produced in `java-plain/` via the volume mount; it is gitignored.)

- [ ] **Step 4: Commit**

```bash
cd ..
git add java-plain/Main.java java-plain/.gitignore
git commit -m "feat(java-plain-poc): frameworkless JDK HttpServer (GET / + POST /echo, IPv4 bind)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 2-stage `Dockerfile.vercel` + `.dockerignore`

Package the server into a small OCI image and verify it serves + binds IPv4 locally.

**Files:**
- Create: `java-plain/Dockerfile.vercel`
- Create: `java-plain/.dockerignore`

**Interfaces:**
- Consumes: `Main.java` from Task 1 (`javac Main.java` → `Main.class`).
- Produces: a runnable image tagged `java-plain` listening on `0.0.0.0:80`, serving `/` and `/echo`.

- [ ] **Step 1: Create `java-plain/Dockerfile.vercel`**

```dockerfile
# ---- Stage 1: compile ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY Main.java .
RUN javac Main.java

# ---- Stage 2: slim runtime ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/Main.class .

# Vercel routes container-function traffic to port 80 by default.
ENV PORT=80
EXPOSE 80

# Explicit IPv4 stack, on top of the 0.0.0.0 bind in Main.java.
CMD ["java", "-Djava.net.preferIPv4Stack=true", "-cp", ".", "Main"]
```

- [ ] **Step 2: Create `java-plain/.dockerignore`**

```dockerignore
*.class
.git
.vercel
*.md
```

- [ ] **Step 3: Build the image**

Run:
```bash
cd java-plain
docker build -f Dockerfile.vercel -t java-plain .
```
Expected: both stages complete and tag `java-plain`.

- [ ] **Step 4: Run the container and verify both endpoints by hand**

Run:
```bash
docker run -d --rm -p 8080:80 --name java-plain java-plain
sleep 2
curl -fsS http://localhost:8080/ ; echo
curl -fsS -X POST http://localhost:8080/echo -H 'Content-Type: application/json' -d '{"hi":1}' ; echo
docker stop java-plain
```
Expected:
- `GET /` → `{"status":"ok","runtime":"java-httpserver","javaVersion":"21...","message":"Hello from plain Java on Vercel"}`
- `POST /echo` → `{"ok":true,"received":"{\"hi\":1}"}`

- [ ] **Step 5: Confirm the server binds IPv4 (0.0.0.0:80)**

Run:
```bash
docker run -d --rm -p 8080:80 --name java-plain java-plain
sleep 2
echo "IPv4 listeners:" && docker exec java-plain sh -c 'cat /proc/net/tcp 2>/dev/null | awk "\$4==\"0A\"{print \$2}"'
echo "IPv6 listeners:" && docker exec java-plain sh -c 'cat /proc/net/tcp6 2>/dev/null | awk "\$4==\"0A\"{print \$2}"'
docker stop java-plain
```
Expected: an IPv4 listener `00000000:0050` (0.0.0.0:80) is present. (Unlike the Spring Boot image, which had only an IPv6 `[::]:80` listener.)

- [ ] **Step 6: Commit**

```bash
cd ..
git add java-plain/Dockerfile.vercel java-plain/.dockerignore
git commit -m "feat(java-plain-poc): add 2-stage Dockerfile.vercel (jdk build -> jre-alpine run)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `vercel.json` + `smoke-test.sh` + `README.md`

Add container-runtime routing, a reusable smoke test, and docs.

**Files:**
- Create: `java-plain/vercel.json`
- Create: `java-plain/smoke-test.sh`
- Create: `java-plain/README.md`

**Interfaces:**
- Consumes: a running instance (local container from Task 2, or a deployed URL from Task 4).
- Produces: `vercel.json` routing all traffic to the container service; `smoke-test.sh <base-url>` exits 0 and prints `All smoke checks passed.` when both endpoints behave.

- [ ] **Step 1: Create `java-plain/vercel.json`**

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

- [ ] **Step 2: Create `java-plain/smoke-test.sh`**

```bash
#!/usr/bin/env bash
# Smoke test for the plain-Java container.
# Usage: ./smoke-test.sh [base-url]   (default: http://localhost:8080)
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

echo "==> GET ${BASE_URL}/"
GET_BODY="$(curl -fsS --connect-timeout 5 --max-time 30 "${BASE_URL}/")"
echo "${GET_BODY}"
if echo "${GET_BODY}" | grep -q '"runtime":"java-httpserver"'; then
  echo "PASS: GET / reports java-httpserver runtime"
else
  echo "FAIL: GET /"; exit 1
fi

echo
echo "==> POST ${BASE_URL}/echo"
POST_BODY="$(curl -fsS --connect-timeout 5 --max-time 30 -X POST "${BASE_URL}/echo" \
  -H 'Content-Type: application/json' -d '{"hello":"vercel","n":1}')"
echo "${POST_BODY}"
if echo "${POST_BODY}" | grep -q '"ok":true' && echo "${POST_BODY}" | grep -q 'hello'; then
  echo "PASS: POST /echo echoed the body"
else
  echo "FAIL: POST /echo"; exit 1
fi

echo
echo "All smoke checks passed."
```

- [ ] **Step 3: Make it executable**

Run:
```bash
chmod +x java-plain/smoke-test.sh
```
Expected: no output; the file gains the executable bit.

- [ ] **Step 4: Create `java-plain/README.md`**

````markdown
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
````

- [ ] **Step 5: Verify the smoke test passes against a local container**

Run:
```bash
cd java-plain
docker run -d --rm -p 8080:80 --name java-plain java-plain
sleep 2
./smoke-test.sh http://localhost:8080
docker stop java-plain
```
Expected: both `PASS:` lines and `All smoke checks passed.` (exit 0). (If the image is missing, rebuild: `docker build -f Dockerfile.vercel -t java-plain .`)

- [ ] **Step 6: Commit**

```bash
cd ..
git add java-plain/vercel.json java-plain/smoke-test.sh java-plain/README.md
git commit -m "docs(java-plain-poc): add vercel.json, smoke-test script, and README

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Deploy to Vercel and verify

Deploy the container function and confirm the endpoints work on a real Vercel URL. Outward-facing — confirm with the user and ensure Vercel auth + Container Images access first.

**Files:** none created/modified (deployment only).

**Interfaces:**
- Consumes: the image definition (Tasks 1–2), `vercel.json`, and `smoke-test.sh` (Task 3).
- Produces: a deployed Vercel URL serving `/` and `/echo` — the diagnostic result.

- [ ] **Step 1: Confirm prerequisites**

Run:
```bash
vercel whoami
```
Expected: prints the logged-in user/team. If it errors, the user runs `! vercel login`. Confirm the target team has **Container Images** access.

- [ ] **Step 2: Deploy as its own project**

To avoid the repo's git integration auto-linking to an existing project, deploy from a copy outside the git repo:
```bash
SRC=$(git -C . rev-parse --show-toplevel)/java-plain
rm -rf /tmp/java-plain-clean && mkdir -p /tmp/java-plain-clean
cp -R "$SRC/Main.java" "$SRC/Dockerfile.vercel" "$SRC/.dockerignore" "$SRC/vercel.json" \
      "$SRC/README.md" "$SRC/smoke-test.sh" /tmp/java-plain-clean/
cd /tmp/java-plain-clean && vercel deploy --yes
```
Expected: a `https://…vercel.app` URL and a successful container build in the logs.

- [ ] **Step 3: Verify the deployment (the diagnostic result)**

Run (substitute the printed URL; if the project has Deployment Protection/SSO, open it in an authenticated browser instead of curl):
```bash
./smoke-test.sh https://<deployment-url>
```
Expected (hoped): both `PASS:` lines. **This is the experiment's answer:**
- Works → the JVM runs fine on Vercel; the Spring Boot failure was framework-specific.
- Fails identically (`INTERNAL_FUNCTION_INVOCATION_FAILED`) → the block is JVM-general on Vercel — record it for the compute team.

- [ ] **Step 4: (Optional) Record the result**

Add the outcome + URL to `java-plain/README.md` and commit:
```bash
cd "$(git rev-parse --show-toplevel)"
git add java-plain/README.md
git commit -m "docs(java-plain-poc): record deployed result

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** isolated `java-plain/` subfolder ✓ (Tasks 1–3); frameworkless JDK `HttpServer`, no deps/build-tool ✓ (Task 1); explicit IPv4 `0.0.0.0` bind + `preferIPv4Stack=true` ✓ (Task 1 code + Task 2 CMD, verified Task 2 Step 5); port from `PORT` default 80 ✓ (Task 1); `GET /` + `POST /echo` response shapes ✓ (Task 1); 2-stage jdk→jre-alpine Docker ✓ (Task 2); no automated tests, smoke-test instead ✓ (Task 3); own Vercel project ✓ (Task 4); other demos untouched ✓ (Global Constraints). jlink/native and JSON libs explicitly out of scope — no task adds them.

**Placeholder scan:** no TBD/TODO; every code step has complete file contents; the only runtime-substituted value is the deployed URL in Task 4.

**Type consistency:** response keys consistent across `Main.java` (`status`,`runtime:"java-httpserver"`,`javaVersion`,`message`; `ok`,`received`), `smoke-test.sh` (greps `"runtime":"java-httpserver"`, `"ok":true`, `hello`), and `README.md`. Class name `Main` matches `Main.java`, `javac Main.java`, `COPY Main.class`, and `-cp . Main`. Port 80 / `0.0.0.0` consistent across `Main.java`, `Dockerfile.vercel` (`ENV PORT=80`/`EXPOSE 80`), `docker run -p 8080:80`, and the IPv4 check. The POST body `{"hi":1}` echoes as the JSON-escaped string `"{\"hi\":1}"` — expected given the hand-rolled escaper.
