# Plain (frameworkless) Java on a Vercel container function — POC design

**Date:** 2026-07-07
**Status:** Approved (design)
**Author:** brainstormed with Claude Code

## Goal

Determine whether a **plain, frameworkless Java** HTTP server (JDK built-in
`com.sun.net.httpserver.HttpServer`, no Spring Boot, no Tomcat, no build tool) runs as a
container-runtime Vercel Function. This is a **diagnostic experiment** following the
`java-spring-boot/` POC, which fails at runtime on Vercel with
`INTERNAL_FUNCTION_INVOCATION_FAILED` despite a proven-correct image (see memory
`spring-boot-vercel-container-blocked`).

Success = `GET /` and `POST /echo` respond correctly both from a local Docker container and
from a deployed Vercel URL.

## Why this experiment

It changes the two most suspicious variables from the Spring Boot run at once, while keeping the
JVM in play so the result is a clean signal:

- **No Spring Boot / Tomcat** — isolates whether the failure was framework-specific.
- **Explicit IPv4 bind in our own code** — `new InetSocketAddress("0.0.0.0", port)` removes the
  ambiguity around Tomcat's default IPv6-wildcard binding.
- **Smaller/faster** — a bare `HttpServer` on a JRE image, near-instant startup.

Outcomes:
- **Works** → the JVM is fine on Vercel; the block was Spring Boot/Tomcat-specific.
- **Fails identically** → the block is JVM-general on Vercel; the framework and (given a comparably
  small image) size theories are both out — strong evidence for the Vercel compute team.

Note: the image-size theory is considered *unlikely* on its own — the Node/Express and Next.js
container images that succeed on this account are of comparable size (~115–200 MB). This
experiment does not chase minimum size (user chose the simplest JRE base); its value is
isolating framework + binding.

## Non-goals

- Not replacing/modifying the root Node demo, `java-spring-boot/`, or `nextjs-docker/`.
- No Maven/Gradle, no dependencies, no Spring — the entire point is frameworkless.
- No jlink/GraalVM minimization (user chose the simplest plain-JRE base).
- No automated test suite (matches the other POCs). Verify via curl + browser + `smoke-test.sh`.

## Approach (isolated subfolder = its own Vercel project)

All new work under `java-plain/`, deployed as its own Vercel container project. `vercel.json`
routes all traffic to the container service (same `services`-block shape as the working demos).

## File layout

```
java-plain/
├── Main.java             # single class: com.sun.net.httpserver.HttpServer, no deps
├── Dockerfile.vercel     # 2-stage: JDK (javac) → JRE-alpine runtime
├── .dockerignore
├── vercel.json           # services block → container runtime; rewrite all → app
├── README.md             # build / run / deploy / curl instructions
└── smoke-test.sh         # curls GET / and POST /echo against a base URL
```

## Server (`Main.java`)

- Uses `com.sun.net.httpserver.HttpServer` from the JDK — no external dependencies.
- Reads the port from the `PORT` environment variable, defaulting to `80`.
- Binds **explicitly to IPv4**: `HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0)`.
- Registers two handlers:
  - `GET /` → `200` JSON `{"status":"ok","runtime":"java-httpserver","javaVersion":"<System.getProperty(\"java.version\")>","message":"Hello from plain Java on Vercel"}`.
    (A non-GET method on `/` returns `405`.)
  - `POST /echo` → reads the request body and returns `{"ok":true,"received":"<body>"}` where the
    body is embedded as a JSON string via a small hand-rolled escaper (escapes `\`, `"`, and
    control chars). A non-POST method on `/echo` returns `405`.
- Uses a small fixed thread pool executor so the server is multi-threaded.
- Writes a startup line to stdout (e.g. `listening on 0.0.0.0:<port>`) as an early liveness signal.

Because there are only two handlers and no framework, this is a single self-contained file.

## Container (`Dockerfile.vercel`, 2-stage)

- **Stage 1 (build):** `eclipse-temurin:21-jdk-alpine`. `COPY Main.java`, `RUN javac Main.java` → `Main.class`.
- **Stage 2 (runtime):** `eclipse-temurin:21-jre-alpine`. `COPY --from=build Main.class`,
  `ENV PORT=80`, `EXPOSE 80`, `CMD ["java","-Djava.net.preferIPv4Stack=true","Main"]`.
- Runs as root (default for temurin) so binding privileged port 80 works.
- `-Djava.net.preferIPv4Stack=true` is belt-and-suspenders on top of the explicit `0.0.0.0` bind.

## Port & lifecycle

- `PORT=80` (Vercel's default container port), bound on IPv4 `0.0.0.0`.
- Vercel routes container-function traffic to port 80; idle instances scale to zero.

## Endpoints

| Route | Method | Response |
| ----- | ------ | -------- |
| `/` | GET | `{"status":"ok","runtime":"java-httpserver","javaVersion":"…","message":"…"}` |
| `/echo` | POST | `{"ok":true,"received":"<request body, JSON-escaped>"}` |

## Verification plan (no automated tests)

1. **Local Docker:** `docker build -f Dockerfile.vercel -t java-plain .` then
   `docker run --rm -p 8080:80 java-plain`; `./smoke-test.sh http://localhost:8080`.
2. **IPv4 check:** confirm the container has an IPv4 listener on port 80 (`0.0.0.0:80`), unlike
   the Spring Boot image which bound IPv6-only by default.
3. **Deploy:** deploy `java-plain/` as its own Vercel project; `./smoke-test.sh <url>` (or browser
   if the project has Deployment Protection/SSO enabled).

`smoke-test.sh` curls `GET /` (expects 200 + `"runtime":"java-httpserver"`) and
`POST /echo` with a sample body (expects `"ok":true` and the body echoed).

## Decisions

- **Frameworkless JDK `HttpServer`** — the lightweight, dependency-free Java HTTP server.
- **Explicit IPv4 bind (`0.0.0.0`) + `preferIPv4Stack=true`** — removes the binding ambiguity from the Spring run.
- **Plain `eclipse-temurin:21-jre-alpine` runtime** (user choice) — simplest; no jlink/native minimization.
- **No build tool, no deps, single `Main.java`** — compiled with `javac` in a JDK build stage.
- **No automated tests** — POC, verified by curl + browser.
- **Own Vercel project** — isolated from the other demos.

## Out of scope

- jlink / GraalVM native image / minimum-size optimization.
- Frameworks, dependencies, build tools, JSON libraries.
- Databases, auth, multiple routes.
