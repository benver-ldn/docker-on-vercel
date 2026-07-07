# Java Spring Boot Container on Vercel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove a Java Spring Boot HTTP server (one GET, one POST), packaged as a Docker image, runs as a container-runtime Vercel Function.

**Architecture:** A self-contained Spring Boot app lives in a new `java-spring-boot/` subfolder with a multi-stage `Dockerfile.vercel` (Maven build stage → slim JRE runtime stage). Vercel auto-detects `Dockerfile.vercel` at the project root and routes all traffic to the container. The subfolder is deployed as its own Vercel project, fully isolated from the existing root Node/Express demo.

**Tech Stack:** Java 21 (Eclipse Temurin), Spring Boot 3.5.x, Maven, Docker (multi-stage), Vercel Functions container runtime.

## Global Constraints

- **All new files live under `java-spring-boot/`.** Do NOT modify any file at the repo root (the root Node demo stays untouched).
- **Java 21 (LTS)**; **Spring Boot 3.5.x** pinned to an exact patch in `pom.xml` (plan uses `3.5.4` — if Maven cannot resolve it, bump to the latest `3.5.x` reported by the build error).
- **Container listens on port 80** (Vercel's default container-function port): `server.port=${PORT:80}` in `application.properties`. Container runs as root so binding 80 works.
- **No automated test suite** (explicit user decision for this POC). Verification is a Docker build + the `smoke-test.sh` curl script — not JUnit.
- **Deployed as its own Vercel project** with Root Directory = `java-spring-boot/` (no `services` block, no shared deployment).
- **Prerequisites for local build/test:** Docker daemon + CLI available locally. **For deploy:** the Vercel team must have **Container Images** access (a gated feature), and the Vercel CLI must be authenticated (`vercel login`).
- **Git:** work stays on branch `java-spring-boot-poc` (already created). Never commit to `main`. Commit after each task. Commit footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (matches the already-committed spec).

---

### Task 1: Spring Boot application source + Maven build config

Create the compilable Spring Boot app. Because there is no local Java/Maven, verification compiles the source *inside* a throwaway Maven Docker container.

**Files:**
- Create: `java-spring-boot/pom.xml`
- Create: `java-spring-boot/src/main/java/com/example/demo/DemoApplication.java`
- Create: `java-spring-boot/src/main/java/com/example/demo/HelloController.java`
- Create: `java-spring-boot/src/main/resources/application.properties`
- Create: `java-spring-boot/.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable Spring Boot fat JAR at `target/demo-0.0.1-SNAPSHOT.jar` after `mvn package`. HTTP surface: `GET /` → JSON object with keys `status`, `runtime`, `javaVersion`, `message`; `POST /echo` → JSON object with keys `ok`, `received`. App reads port from `server.port=${PORT:80}`.

- [ ] **Step 1: Create `java-spring-boot/pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.4</version>
    <relativePath/>
  </parent>

  <groupId>com.example</groupId>
  <artifactId>demo</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>demo</name>
  <description>Spring Boot container on Vercel POC</description>

  <properties>
    <java.version>21</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 2: Create `java-spring-boot/src/main/java/com/example/demo/DemoApplication.java`**

```java
package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

- [ ] **Step 3: Create `java-spring-boot/src/main/java/com/example/demo/HelloController.java`**

```java
package com.example.demo;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    // GET / — proves a real JVM booted by reporting the live Java version.
    @GetMapping("/")
    public Map<String, Object> index() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("runtime", "spring-boot");
        body.put("javaVersion", System.getProperty("java.version"));
        body.put("message", "Hello from Spring Boot on Vercel");
        return body;
    }

    // POST /echo — echoes back whatever JSON was sent (object, array, scalar, or empty).
    @PostMapping("/echo")
    public Map<String, Object> echo(@RequestBody(required = false) Object received) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("received", received);
        return body;
    }
}
```

- [ ] **Step 4: Create `java-spring-boot/src/main/resources/application.properties`**

```properties
# Vercel routes container-function traffic to port 80 by default; honor a PORT override if set.
server.port=${PORT:80}
# Drain in-flight requests on Vercel's SIGTERM at scale-down.
server.shutdown=graceful
```

- [ ] **Step 5: Create `java-spring-boot/.gitignore`**

```gitignore
target/
```

- [ ] **Step 6: Verify the source compiles and produces a JAR (compiles inside Docker — no local Java needed)**

Run:
```bash
cd java-spring-boot
docker run --rm -v "$PWD":/app -w /app maven:3.9-eclipse-temurin-21 mvn -q -B -DskipTests package
ls target/*.jar
```
Expected: Maven downloads dependencies and finishes with `BUILD SUCCESS`; `ls` shows `target/demo-0.0.1-SNAPSHOT.jar`.
If Maven reports the parent version `3.5.4` cannot be resolved, edit `pom.xml` `<version>` to the latest `3.5.x` it lists and re-run.

- [ ] **Step 7: Commit**

```bash
cd ..
git add java-spring-boot/pom.xml java-spring-boot/src java-spring-boot/.gitignore
git commit -m "feat(java-poc): scaffold Spring Boot app source and Maven config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Multi-stage `Dockerfile.vercel` + `.dockerignore`

Package the app into an OCI image that Vercel can run, and verify it serves both endpoints locally.

**Files:**
- Create: `java-spring-boot/Dockerfile.vercel`
- Create: `java-spring-boot/.dockerignore`

**Interfaces:**
- Consumes: `pom.xml`, `src/` from Task 1; produces the fat JAR internally via the build stage.
- Produces: a runnable image whose container listens on port 80 and serves `GET /` and `POST /echo`.

- [ ] **Step 1: Create `java-spring-boot/Dockerfile.vercel`**

```dockerfile
# ---- Stage 1: build the fat JAR with Maven (no local Java/Maven needed) ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache dependencies first so this layer is reused unless pom.xml changes.
COPY pom.xml .
RUN mvn -q -B dependency:go-offline

# Build the application.
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- Stage 2: slim runtime image ----
FROM eclipse-temurin:21-jre
WORKDIR /app

# Exactly one *.jar is produced by spring-boot-maven-plugin (the .jar.original is not matched).
COPY --from=build /build/target/*.jar /app/app.jar

# Vercel routes container-function traffic to port 80 by default.
ENV PORT=80
EXPOSE 80

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

- [ ] **Step 2: Create `java-spring-boot/.dockerignore`**

```dockerignore
target/
.git/
*.md
.env*
```

- [ ] **Step 3: Build the image**

Run:
```bash
cd java-spring-boot
docker build -f Dockerfile.vercel -t java-spring-demo .
```
Expected: build completes with `BUILD SUCCESS` in the Maven stage and a final `naming to docker.io/library/java-spring-demo` (or equivalent) line.

- [ ] **Step 4: Run the container and verify both endpoints by hand**

Run (map host 8080 → container 80):
```bash
docker run -d --rm -p 8080:80 --name java-spring-demo java-spring-demo
sleep 8   # give the JVM/Spring a few seconds to boot
curl -fsS http://localhost:8080/ ; echo
curl -fsS -X POST http://localhost:8080/echo -H 'Content-Type: application/json' -d '{"hi":1}' ; echo
docker stop java-spring-demo
```
Expected:
- `GET /` → `{"status":"ok","runtime":"spring-boot","javaVersion":"21...","message":"Hello from Spring Boot on Vercel"}`
- `POST /echo` → `{"ok":true,"received":{"hi":1}}`

- [ ] **Step 5: Commit**

```bash
cd ..
git add java-spring-boot/Dockerfile.vercel java-spring-boot/.dockerignore
git commit -m "feat(java-poc): add multi-stage Dockerfile.vercel and dockerignore

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `smoke-test.sh` + `README.md`

Add a reusable smoke test (works against local Docker or a deployed URL) and folder documentation.

**Files:**
- Create: `java-spring-boot/smoke-test.sh`
- Create: `java-spring-boot/README.md`

**Interfaces:**
- Consumes: a running instance (local container from Task 2, or a deployed URL from Task 4) exposing `GET /` and `POST /echo`.
- Produces: `smoke-test.sh <base-url>` — exits 0 and prints `All smoke checks passed.` when both endpoints behave; exits non-zero otherwise.

- [ ] **Step 1: Create `java-spring-boot/smoke-test.sh`**

```bash
#!/usr/bin/env bash
# Smoke test for the Spring Boot container.
# Usage: ./smoke-test.sh [base-url]   (default: http://localhost:8080)
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

echo "==> GET ${BASE_URL}/"
GET_BODY="$(curl -fsS "${BASE_URL}/")"
echo "${GET_BODY}"
if echo "${GET_BODY}" | grep -q '"runtime":"spring-boot"'; then
  echo "PASS: GET / reports spring-boot runtime"
else
  echo "FAIL: GET / did not report spring-boot runtime"; exit 1
fi

echo
echo "==> POST ${BASE_URL}/echo"
POST_BODY="$(curl -fsS -X POST "${BASE_URL}/echo" \
  -H 'Content-Type: application/json' \
  -d '{"hello":"vercel","n":1}')"
echo "${POST_BODY}"
if echo "${POST_BODY}" | grep -q '"hello":"vercel"'; then
  echo "PASS: POST /echo echoed the body"
else
  echo "FAIL: POST /echo did not echo the body"; exit 1
fi

echo
echo "All smoke checks passed."
```

- [ ] **Step 2: Make it executable**

Run:
```bash
chmod +x java-spring-boot/smoke-test.sh
```
Expected: no output; the file gains the executable bit.

- [ ] **Step 3: Create `java-spring-boot/README.md`**

````markdown
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

Vercel auto-detects `Dockerfile.vercel`, builds the image, pushes it to the Vercel Container Registry,
and routes all traffic to the container. The function scales to zero when idle.

## Quick manual test

```bash
curl http://localhost:8080/
curl -X POST http://localhost:8080/echo -H 'Content-Type: application/json' -d '{"hi":1}'
```
````

- [ ] **Step 4: Verify the smoke test passes against a local container**

Run:
```bash
cd java-spring-boot
docker run -d --rm -p 8080:80 --name java-spring-demo java-spring-demo
sleep 8
./smoke-test.sh http://localhost:8080
docker stop java-spring-demo
```
Expected: script prints both `PASS:` lines and ends with `All smoke checks passed.` (exit code 0).

- [ ] **Step 5: Commit**

```bash
cd ..
git add java-spring-boot/smoke-test.sh java-spring-boot/README.md
git commit -m "docs(java-poc): add smoke-test script and folder README

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Deploy to a Vercel preview and verify

Deploy the container function and confirm the endpoints work on a real Vercel URL. This is an outward-facing action — confirm with the user and ensure Vercel CLI auth + Container Images access before running.

**Files:** none created/modified (deployment only; optionally record the live URL in `README.md`).

**Interfaces:**
- Consumes: the working image definition from Tasks 1–2 and `smoke-test.sh` from Task 3.
- Produces: a deployed Vercel preview URL serving `GET /` and `POST /echo`.

- [ ] **Step 1: Confirm prerequisites**

Run:
```bash
vercel whoami
```
Expected: prints the logged-in user/team. If it errors, the user runs `! vercel login` in the session first. Confirm the target team has **Container Images** access (gated feature) before deploying.

- [ ] **Step 2: Deploy a preview from inside the subfolder**

Run:
```bash
cd java-spring-boot
vercel deploy
```
When prompted, create a **new** project (accept the `java-spring-boot` directory as the project root — do NOT link it to the existing Node project). Vercel builds `Dockerfile.vercel`, pushes to VCR, and prints a preview URL.
Expected: a `https://<project>-<hash>-<team>.vercel.app` preview URL and a successful build log showing the Docker image build.

- [ ] **Step 3: Smoke-test the deployed preview**

Run (substitute the printed URL):
```bash
./smoke-test.sh https://<preview-url>
```
Expected: both `PASS:` lines and `All smoke checks passed.` The first request may take a few seconds (cold start) — re-run once if the very first curl times out.

- [ ] **Step 4: (Optional) Promote to production**

Run:
```bash
vercel deploy --prod
./smoke-test.sh https://<production-url>
```
Expected: same passing smoke test against the production URL.

- [ ] **Step 5: (Optional) Record the live URL and finish the branch**

If you want the URL in the repo, add a line to `java-spring-boot/README.md` under "Deploy to Vercel" and commit:
```bash
cd ..
git add java-spring-boot/README.md
git commit -m "docs(java-poc): record deployed preview URL

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
Then push the branch and open a PR per the repo workflow (`git push -u origin java-spring-boot-poc`).

---

## Self-Review

**Spec coverage:** isolated `java-spring-boot/` subfolder ✓ (Tasks 1–3); Maven + JDK 21 + Spring Boot 3.5.x ✓ (Task 1); multi-stage Dockerfile → JRE runtime ✓ (Task 2); port 80 via `server.port=${PORT:80}` + graceful shutdown ✓ (Task 1); `GET /` with live Java version + `POST /echo` ✓ (Task 1); no automated tests, smoke-test instead ✓ (Task 3); separate Vercel project deploy ✓ (Task 4); root Node demo untouched ✓ (Global Constraints). GraalVM/cold-start explicitly out of scope — not in any task ✓.

**Placeholder scan:** no TBD/TODO; every code step contains complete file contents; the only intentional substitution is the deployed URL in Task 4 (unknowable until deploy) and the Spring Boot patch-version fallback note.

**Type consistency:** `GET /` keys (`status`, `runtime`, `javaVersion`, `message`) and `POST /echo` keys (`ok`, `received`) are consistent across `HelloController.java`, `smoke-test.sh` (greps `"runtime":"spring-boot"` and `"hello":"vercel"`), and `README.md`. JAR path `target/demo-0.0.1-SNAPSHOT.jar` matches `artifactId=demo` + `version=0.0.1-SNAPSHOT`. Container port 80 consistent across `application.properties`, `Dockerfile.vercel` (`EXPOSE 80`), and `docker run -p 8080:80`.
