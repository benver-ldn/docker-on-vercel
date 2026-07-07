# Java Spring Boot in a Docker container on a Vercel Function — POC design

**Date:** 2026-07-07
**Status:** Approved (design)
**Author:** brainstormed with Claude Code

## Goal

Prove that a Java Spring Boot HTTP server, packaged as a Docker image, can run as a
**container-runtime Vercel Function** — the same pattern the existing Node/Express demo at
the repo root already demonstrates. Success = the two endpoints below respond correctly
both from a local Docker container and from a deployed Vercel URL.

This is a throwaway proof of concept. The function is invoked on demand and scales to zero;
it is **not** a long-lived server.

## Non-goals

- Not replacing or modifying the existing root Node/Express demo. Nothing at the repo root changes.
- No fast cold starts / GraalVM native image (a plain JVM cold start of a few seconds is acceptable).
- No automated test suite (explicit user decision for this demo — see Decisions). Verification is a curl smoke test.
- Not a combined/multi-service single deployment — the Java app is its own Vercel project.

## Approach (chosen: A — isolated subfolder = its own Vercel project)

All new work lives under `java-spring-boot/`, deployed as a **separate Vercel project** whose
Root Directory points at that folder (or `cd java-spring-boot && vercel deploy`). Vercel
auto-detects `Dockerfile.vercel` at that root and auto-adds a rewrite routing all traffic to it.

Rejected alternatives:
- **B — single project with a `services` block** routing `/java/*` to the Java service. Couples the
  two demos into one deployment, touches the working root `vercel.json`, and forces Spring Boot to
  handle a path prefix. Against the isolation goal.
- **C — local Docker only.** Local Docker testing is already part of Approach A's verification.

## File layout

Everything new is under `java-spring-boot/`:

```
java-spring-boot/
├── Dockerfile.vercel                 # multi-stage: Maven build → slim JRE runtime
├── pom.xml                           # Spring Boot 3.5.x, spring-boot-starter-web, Java 21
├── .dockerignore
├── README.md                         # build / run / deploy / curl instructions
├── smoke-test.sh                     # curls GET / and POST /echo against a given base URL
└── src/main/
    ├── java/com/example/demo/
    │   ├── DemoApplication.java      # @SpringBootApplication entrypoint
    │   └── HelloController.java       # GET / and POST /echo
    └── resources/
        └── application.properties      # server.port=${PORT:80}, graceful shutdown
```

## Container (`Dockerfile.vercel`, multi-stage)

- **Stage 1 (build):** `maven:3.9-eclipse-temurin-21`. Copy `pom.xml`, warm the dependency cache,
  copy `src`, run `mvn -q -DskipTests package` → produces the fat JAR under `target/`.
- **Stage 2 (runtime):** `eclipse-temurin:21-jre`. Copy the JAR to `/app/app.jar`,
  `ENV PORT=80`, `EXPOSE 80`, `ENTRYPOINT ["java","-jar","/app/app.jar"]`.
- Runs as root so binding privileged port 80 works — same as the root Node demo.
  Hardening alternative (not used here): non-root user + `PORT=8080` set in Vercel project settings.

Because the build happens inside the Docker image, **no local Java or Maven install is required**.
Docker is only needed for local testing; Vercel builds the image in the cloud on deploy.

## Port & lifecycle

- `application.properties` sets `server.port=${PORT:80}` — binds 80 by default (Vercel's default
  container port) and honors a `PORT` override if one is ever set in project settings.
- Embedded Tomcat binds `0.0.0.0` by default.
- `server.shutdown=graceful` so Spring Boot drains cleanly on Vercel's SIGTERM at scale-down
  (5 min idle in production, 30 s in preview).

## Endpoints

| Method | Path     | Response |
| ------ | -------- | -------- |
| GET    | `/`      | `{ "status":"ok", "runtime":"spring-boot", "javaVersion": <live System property>, "message":"Hello from Spring Boot on Vercel" }` |
| POST   | `/echo`  | Accepts arbitrary JSON via `@RequestBody`; returns `{ "ok":true, "received": <body> }`. Empty/invalid JSON → Spring's default 400. |

Reporting the live `java.version` on `GET /` is the "yes, a JVM really booted in the function" signal.

## Data flow

Client → Vercel → container function (Spring Boot / embedded Tomcat on :80) → controller → JSON.
First request cold-starts the JVM + Spring context (a few seconds, acceptable). Idle → scale to zero.

## Verification plan (no automated tests)

1. **Local Docker:** `docker build -f Dockerfile.vercel -t java-spring-demo .` then
   `docker run -p 8080:80 java-spring-demo`, then `./smoke-test.sh http://localhost:8080`.
2. **Optional** `vercel dev` (needs the Docker daemon + CLI).
3. **Deploy:** link `java-spring-boot/` as its own Vercel project, `vercel deploy` (preview),
   then `./smoke-test.sh <preview-url>`. Promote to production if desired.

`smoke-test.sh` curls `GET /` (expects 200 + `runtime":"spring-boot"`) and
`POST /echo` with a sample JSON body (expects the body echoed back). It is the API analogue of an E2E check.

## Decisions

- **Automated tests intentionally omitted.** The user explicitly chose to skip a JUnit/MockMvc suite
  for this demo. This overrides the repo's default "always write tests" rule; verification is the
  curl smoke test instead.
- **Second Vercel project** (not a `services` block) — keeps the Java demo fully isolated from the Node demo.
- **Root + port 80** (not non-root + 8080) — zero dashboard config, mirrors the working Node demo.
- **Spring Boot 3.5.x + Java 21 (LTS) + Maven**, multi-stage Docker build. Exact patch pinned in `pom.xml`.

## Out of scope

- GraalVM native image / cold-start optimization.
- Persistent state, databases, secrets.
- Modifying the root Node demo or combining both into one deployment.
