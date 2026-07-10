# Java Microservices on Vercel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a product-search demo proving a full microservice architecture — a Next.js frontend and four independently-deployed Spring Boot services — runs on Vercel container functions.

**Architecture:** Next.js (`ms-web`) calls one Spring Boot gateway (`ms-gateway`) server-side. The gateway fans out over HTTP to three Spring Boot services — `ms-catalog` (search), `ms-inventory` (stock), `ms-reviews` (ratings) — each owning in-memory data, and merges the results. Each folder is its own Vercel project (container runtime for the Java services, Node for Next.js).

**Tech Stack:** Java 21, Spring Boot 3.3.5, Maven, Docker (2-stage build), Next.js (App Router, TypeScript, Tailwind), Vercel container functions.

## Global Constraints

- **Java 21** for every service (`<java.version>21</java.version>`).
- **Spring Boot 3.3.5** pinned identically across all four services (parent POM version).
- **Build tool:** Maven; fat jar via `spring-boot-maven-plugin`.
- **Container pattern (proven, non-negotiable):** 2-stage `Dockerfile.vercel`; runtime stage `eclipse-temurin:21-jre-alpine`; **`java` invoked by absolute path** `/opt/java/openjdk/bin/java` (Vercel does not honor image `ENV PATH`); bind `0.0.0.0`; listen on `$PORT` (Vercel routes to port 80).
- **Shared product IDs 1–12** across catalog, inventory, reviews. The gateway joins downstream data on `id`.
- **No local JVM/Maven** — all Java build/run happens inside Docker. The test loop for every service is `docker build` → `docker run` → `smoke-test.sh`.
- **Gateway resilience:** inventory/reviews calls are best-effort with a 10s timeout; on failure the product returns with `stock: null` / `rating: null` and the request still succeeds. The catalog call is required (its failure propagates).
- **Env wiring is manual** (deploy service → copy prod URL → set on consumer → redeploy). Documented, not automated.
- **Out of scope:** auth, persistence, service discovery, message queues, observability beyond Vercel logs, min-instance tuning.
- **Local port map:** catalog `8081`, inventory `8082`, reviews `8083`, gateway `8080` (all → container port 80).

---

## Shared Spring Boot service skeleton

Every Java service (`ms-catalog`, `ms-inventory`, `ms-reviews`, `ms-gateway`) has this file layout:

```
ms-<svc>/
├─ pom.xml
├─ Dockerfile.vercel
├─ vercel.json
├─ .dockerignore
├─ .gitignore
├─ smoke-test.sh
├─ README.md
└─ src/main/
   ├─ java/com/example/<svc>/<Svc>Application.java
   ├─ java/com/example/<svc>/<Svc>Controller.java
   └─ resources/application.properties
```

These files are **identical except for the substitution tokens** `<svc>` (lowercase artifact, e.g. `catalog`) and `<Svc>` (capitalized class prefix, e.g. `Catalog`). Each task states its tokens, then gives its unique controller + any extra config.

**`pom.xml`** (substitute `<svc>` in `<artifactId>`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.5</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId><svc></artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

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

**`src/main/java/com/example/<svc>/<Svc>Application.java`**:

```java
package com.example.<svc>;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class <Svc>Application {
    public static void main(String[] args) {
        SpringApplication.run(<Svc>Application.class, args);
    }
}
```

**`src/main/resources/application.properties`** (gateway adds three extra lines — see Task 4):

```properties
server.address=0.0.0.0
server.port=${PORT:80}
spring.application.name=<svc>
```

**`Dockerfile.vercel`** (identical for all four):

```dockerfile
# ---- Stage 1: build fat jar ----
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B clean package -DskipTests

# ---- Stage 2: slim runtime ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Vercel routes container-function traffic to port 80.
ENV PORT=80
EXPOSE 80

# Call java by ABSOLUTE PATH. Vercel's container runtime does not honor the
# image's ENV PATH; temurin installs java at /opt/java/openjdk/bin, so a bare
# "java" resolves to "not found" on Vercel and the JVM never starts.
#
# FAST-START flags are REQUIRED: default Spring Boot cold start (~7-10s) exceeds
# Vercel's container readiness window → every scale-from-zero request 500s
# (INTERNAL_FUNCTION_INVOCATION_FAILED). These cut startup to ~1s locally.
#   -XX:+UseSerialGC / -XX:TieredStopAtLevel=1 / -Xss512k / lazy-initialization
CMD ["/opt/java/openjdk/bin/java", \
     "-XX:+UseSerialGC", \
     "-XX:TieredStopAtLevel=1", \
     "-Xss512k", \
     "-Dspring.main.lazy-initialization=true", \
     "-Djava.net.preferIPv4Stack=true", \
     "-jar", "app.jar"]
```

> **Deploy-gate lesson (Task 1):** a bare `java -jar` CMD deploys but 500s on every request because
> the JVM cold start exceeds Vercel's readiness window. The fast-start flags above are what make it
> serve. All four services MUST use this CMD. See memory `spring-boot-vercel-cold-start`.

**`vercel.json`** (identical for all four):

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

**`.dockerignore`** (identical):

```
target
.git
.vercel
*.md
```

**`.gitignore`** (identical):

```
target/
.vercel/
```

---

## Task 1: `ms-catalog` service + Vercel deploy gate

**This is the de-risk milestone.** Full Spring Boot fat-jar on a Vercel container is unproven; do not build Tasks 2–5 until the live smoke test here passes.

**Tokens:** `<svc>` = `catalog`, `<Svc>` = `Catalog`.

**Files:**
- Create: `ms-catalog/pom.xml`, `ms-catalog/Dockerfile.vercel`, `ms-catalog/vercel.json`, `ms-catalog/.dockerignore`, `ms-catalog/.gitignore`, `ms-catalog/README.md` (all from the skeleton)
- Create: `ms-catalog/src/main/java/com/example/catalog/CatalogApplication.java` (from skeleton)
- Create: `ms-catalog/src/main/resources/application.properties` (from skeleton, name=catalog)
- Create: `ms-catalog/src/main/java/com/example/catalog/CatalogController.java` (unique, below)
- Test: `ms-catalog/smoke-test.sh`

**Interfaces:**
- Produces: `GET /health` → `{"status":"ok","service":"catalog"}`; `GET /products?q=&category=` → JSON array of `{id:int, name, category, price:number, description}`. Consumed by the gateway (Task 4).

- [ ] **Step 1: Write the failing test** — `ms-catalog/smoke-test.sh`

```bash
#!/usr/bin/env bash
# Smoke test for ms-catalog. Usage: ./smoke-test.sh [base-url]
set -euo pipefail
BASE_URL="${1:-http://localhost:8081}"

echo "==> GET ${BASE_URL}/health"
curl -fsS --max-time 30 "${BASE_URL}/health" | grep -q '"service":"catalog"' \
  && echo "PASS: health" || { echo "FAIL: health"; exit 1; }

echo "==> GET ${BASE_URL}/products?q=keyboard"
curl -fsS --max-time 30 "${BASE_URL}/products?q=keyboard" | grep -q 'Mechanical Keyboard' \
  && echo "PASS: search by q" || { echo "FAIL: search by q"; exit 1; }

echo "==> GET ${BASE_URL}/products?category=Sports"
BODY="$(curl -fsS --max-time 30 "${BASE_URL}/products?category=Sports")"
echo "${BODY}" | grep -q 'Yoga Mat' && ! echo "${BODY}" | grep -q 'Mechanical Keyboard' \
  && echo "PASS: filter by category" || { echo "FAIL: filter by category"; exit 1; }

echo "All catalog smoke checks passed."
```

Then `chmod +x ms-catalog/smoke-test.sh`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ms-catalog && ./smoke-test.sh`
Expected: FAIL (connection refused — nothing running yet).

- [ ] **Step 3: Create skeleton files**

Create `ms-catalog/pom.xml`, `Dockerfile.vercel`, `vercel.json`, `.dockerignore`, `.gitignore` from the Shared Skeleton (tokens: catalog/Catalog). Create `src/main/java/com/example/catalog/CatalogApplication.java` and `src/main/resources/application.properties` (name=catalog) from the skeleton.

- [ ] **Step 4: Write the controller** — `ms-catalog/src/main/java/com/example/catalog/CatalogController.java`

```java
package com.example.catalog;

import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
public class CatalogController {

    record Product(int id, String name, String category, double price, String description) {}

    private static final List<Product> PRODUCTS = List.of(
        new Product(1, "Wireless Headphones", "Electronics", 79.99, "Over-ear Bluetooth headphones with noise cancelling"),
        new Product(2, "Mechanical Keyboard", "Electronics", 119.99, "Hot-swappable RGB mechanical keyboard"),
        new Product(3, "4K Monitor", "Electronics", 329.99, "27-inch 4K UHD IPS monitor"),
        new Product(4, "USB-C Hub", "Electronics", 39.99, "7-in-1 USB-C hub with HDMI and card reader"),
        new Product(5, "Espresso Machine", "Home", 249.99, "15-bar pump espresso machine with milk frother"),
        new Product(6, "Robot Vacuum", "Home", 299.99, "Self-charging robot vacuum with lidar mapping"),
        new Product(7, "Air Purifier", "Home", 149.99, "HEPA air purifier for large rooms"),
        new Product(8, "Standing Desk", "Home", 399.99, "Electric height-adjustable standing desk"),
        new Product(9, "Yoga Mat", "Sports", 29.99, "Non-slip eco-friendly yoga mat"),
        new Product(10, "Dumbbell Set", "Sports", 89.99, "Adjustable dumbbell set 5-25kg"),
        new Product(11, "Running Shoes", "Sports", 109.99, "Lightweight cushioned running shoes"),
        new Product(12, "Water Bottle", "Sports", 19.99, "Insulated stainless steel water bottle")
    );

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "catalog");
    }

    @GetMapping("/products")
    public List<Product> products(@RequestParam(defaultValue = "") String q,
                                  @RequestParam(required = false) String category) {
        String needle = q.toLowerCase(Locale.ROOT).trim();
        return PRODUCTS.stream()
            .filter(p -> needle.isEmpty()
                || p.name().toLowerCase(Locale.ROOT).contains(needle)
                || p.description().toLowerCase(Locale.ROOT).contains(needle))
            .filter(p -> category == null || category.isBlank()
                || p.category().equalsIgnoreCase(category))
            .collect(Collectors.toList());
    }
}
```

- [ ] **Step 5: Build the image**

Run: `cd ms-catalog && docker build -f Dockerfile.vercel -t ms-catalog .`
Expected: build succeeds; final line shows the tagged image.

- [ ] **Step 6: Run the container**

Run: `docker run --rm -d -p 8081:80 --name ms-catalog ms-catalog`
Then wait for startup: `sleep 8` (JVM boot).

- [ ] **Step 7: Run the smoke test to verify it passes**

Run: `cd ms-catalog && ./smoke-test.sh`
Expected: `All catalog smoke checks passed.`
Then stop: `docker stop ms-catalog`.

- [ ] **Step 8: Write `README.md`** — `ms-catalog/README.md`

```markdown
# ms-catalog

Spring Boot search/catalog microservice. Owns ~12 products in-memory.

## Endpoints
- `GET /health` → `{"status":"ok","service":"catalog"}`
- `GET /products?q=<text>&category=<cat>` → array of matching products

## Local (Docker only — no local JVM needed)
    docker build -f Dockerfile.vercel -t ms-catalog .
    docker run --rm -d -p 8081:80 --name ms-catalog ms-catalog
    ./smoke-test.sh http://localhost:8081
    docker stop ms-catalog

## Deploy
Deploy this folder as its own Vercel project (Root Directory = this folder):
    vercel deploy --prod
    ./smoke-test.sh <prod-url>
```

- [ ] **Step 9: Commit**

```bash
git add ms-catalog
git commit -m "feat(ms-catalog): Spring Boot catalog search service (Docker/Vercel)"
```

- [ ] **Step 10: Deploy to Vercel (the gate)**

Run: `cd ms-catalog && vercel link` (create a new project, Root Directory = current), then `vercel deploy --prod`.
Expected: a production URL. Record it.

- [ ] **Step 11: Live smoke test (the gate)**

Run: `cd ms-catalog && ./smoke-test.sh <prod-url>`
Expected: `All catalog smoke checks passed.`
**If this fails, STOP** — diagnose Spring-Boot-on-Vercel (check function logs: `vercel logs <url>`) before building any other service. Verify the container CMD uses the absolute java path.

- [ ] **Step 12: Record the win in memory**

Update `~/.claude/projects/-Users-benakehurst-Documents-vercel-demo-apps-docker-on-vercel/memory/spring-boot-vercel-container-blocked.md`: append a line noting a full Spring Boot 3.3.5 fat-jar (starter-web) is now confirmed serving on a Vercel container via the absolute-path CMD, referencing project `ms-catalog`.

---

## Task 2: `ms-inventory` service

**Tokens:** `<svc>` = `inventory`, `<Svc>` = `Inventory`.

**Files:**
- Create: all skeleton files under `ms-inventory/` (tokens inventory/Inventory), `application.properties` name=inventory
- Create: `ms-inventory/src/main/java/com/example/inventory/InventoryController.java` (below)
- Create: `ms-inventory/README.md`
- Test: `ms-inventory/smoke-test.sh`

**Interfaces:**
- Produces: `GET /health` → `{"status":"ok","service":"inventory"}`; `GET /stock?ids=1,2,3` → JSON object `{"1":42,...}` (string id → int qty), only for known requested ids. Consumed by the gateway (Task 4).

- [ ] **Step 1: Write the failing test** — `ms-inventory/smoke-test.sh`

```bash
#!/usr/bin/env bash
# Smoke test for ms-inventory. Usage: ./smoke-test.sh [base-url]
set -euo pipefail
BASE_URL="${1:-http://localhost:8082}"

echo "==> GET ${BASE_URL}/health"
curl -fsS --max-time 30 "${BASE_URL}/health" | grep -q '"service":"inventory"' \
  && echo "PASS: health" || { echo "FAIL: health"; exit 1; }

echo "==> GET ${BASE_URL}/stock?ids=1,2"
BODY="$(curl -fsS --max-time 30 "${BASE_URL}/stock?ids=1,2")"
echo "${BODY}" | grep -q '"1":42' && echo "${BODY}" | grep -q '"2":0' \
  && echo "PASS: stock lookup" || { echo "FAIL: stock lookup"; exit 1; }

echo "All inventory smoke checks passed."
```

Then `chmod +x ms-inventory/smoke-test.sh`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ms-inventory && ./smoke-test.sh`
Expected: FAIL (connection refused).

- [ ] **Step 3: Create skeleton files** (tokens inventory/Inventory, properties name=inventory).

- [ ] **Step 4: Write the controller** — `ms-inventory/src/main/java/com/example/inventory/InventoryController.java`

```java
package com.example.inventory;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
public class InventoryController {

    // Shared product IDs 1-12. Some zeros to exercise the "out of stock" UI.
    private static final Map<Integer, Integer> STOCK = Map.ofEntries(
        Map.entry(1, 42), Map.entry(2, 0), Map.entry(3, 7), Map.entry(4, 120),
        Map.entry(5, 15), Map.entry(6, 3), Map.entry(7, 0), Map.entry(8, 9),
        Map.entry(9, 230), Map.entry(10, 18), Map.entry(11, 0), Map.entry(12, 512)
    );

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "inventory");
    }

    @GetMapping("/stock")
    public Map<String, Integer> stock(@RequestParam String ids) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String part : ids.split(",")) {
            String t = part.trim();
            if (t.isEmpty()) continue;
            try {
                int id = Integer.parseInt(t);
                if (STOCK.containsKey(id)) out.put(t, STOCK.get(id));
            } catch (NumberFormatException ignored) { }
        }
        return out;
    }
}
```

- [ ] **Step 5: Build** — `cd ms-inventory && docker build -f Dockerfile.vercel -t ms-inventory .` (expect success).
- [ ] **Step 6: Run** — `docker run --rm -d -p 8082:80 --name ms-inventory ms-inventory && sleep 8`.
- [ ] **Step 7: Smoke test** — `cd ms-inventory && ./smoke-test.sh` → `All inventory smoke checks passed.`; then `docker stop ms-inventory`.

- [ ] **Step 8: Write `README.md`** — `ms-inventory/README.md`

```markdown
# ms-inventory

Spring Boot inventory microservice. Owns stock levels (product id 1-12) in-memory.

## Endpoints
- `GET /health` → `{"status":"ok","service":"inventory"}`
- `GET /stock?ids=1,2,3` → `{"1":42,"2":0,...}`

## Local
    docker build -f Dockerfile.vercel -t ms-inventory .
    docker run --rm -d -p 8082:80 --name ms-inventory ms-inventory
    ./smoke-test.sh http://localhost:8082
    docker stop ms-inventory
```

- [ ] **Step 9: Commit**

```bash
git add ms-inventory
git commit -m "feat(ms-inventory): Spring Boot stock-level service"
```

---

## Task 3: `ms-reviews` service

**Tokens:** `<svc>` = `reviews`, `<Svc>` = `Reviews`.

**Files:**
- Create: all skeleton files under `ms-reviews/` (tokens reviews/Reviews), `application.properties` name=reviews
- Create: `ms-reviews/src/main/java/com/example/reviews/ReviewsController.java` (below)
- Create: `ms-reviews/README.md`
- Test: `ms-reviews/smoke-test.sh`

**Interfaces:**
- Produces: `GET /health` → `{"status":"ok","service":"reviews"}`; `GET /ratings?ids=1,2,3` → JSON object `{"1":{"avg":4.5,"count":128},...}`. Consumed by the gateway (Task 4).

- [ ] **Step 1: Write the failing test** — `ms-reviews/smoke-test.sh`

```bash
#!/usr/bin/env bash
# Smoke test for ms-reviews. Usage: ./smoke-test.sh [base-url]
set -euo pipefail
BASE_URL="${1:-http://localhost:8083}"

echo "==> GET ${BASE_URL}/health"
curl -fsS --max-time 30 "${BASE_URL}/health" | grep -q '"service":"reviews"' \
  && echo "PASS: health" || { echo "FAIL: health"; exit 1; }

echo "==> GET ${BASE_URL}/ratings?ids=1"
BODY="$(curl -fsS --max-time 30 "${BASE_URL}/ratings?ids=1")"
echo "${BODY}" | grep -q '"avg":4.5' && echo "${BODY}" | grep -q '"count":128' \
  && echo "PASS: ratings lookup" || { echo "FAIL: ratings lookup"; exit 1; }

echo "All reviews smoke checks passed."
```

Then `chmod +x ms-reviews/smoke-test.sh`.

- [ ] **Step 2: Run the test to verify it fails** — `cd ms-reviews && ./smoke-test.sh` → FAIL (connection refused).

- [ ] **Step 3: Create skeleton files** (tokens reviews/Reviews, properties name=reviews).

- [ ] **Step 4: Write the controller** — `ms-reviews/src/main/java/com/example/reviews/ReviewsController.java`

```java
package com.example.reviews;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
public class ReviewsController {

    record Rating(double avg, int count) {}

    // Shared product IDs 1-12.
    private static final Map<Integer, Rating> RATINGS = Map.ofEntries(
        Map.entry(1, new Rating(4.5, 128)), Map.entry(2, new Rating(4.7, 342)),
        Map.entry(3, new Rating(4.2, 89)),  Map.entry(4, new Rating(4.0, 54)),
        Map.entry(5, new Rating(4.6, 210)), Map.entry(6, new Rating(3.9, 76)),
        Map.entry(7, new Rating(4.3, 41)),  Map.entry(8, new Rating(4.8, 165)),
        Map.entry(9, new Rating(4.1, 300)), Map.entry(10, new Rating(4.4, 98)),
        Map.entry(11, new Rating(4.5, 512)),Map.entry(12, new Rating(4.9, 77))
    );

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "reviews");
    }

    @GetMapping("/ratings")
    public Map<String, Rating> ratings(@RequestParam String ids) {
        Map<String, Rating> out = new LinkedHashMap<>();
        for (String part : ids.split(",")) {
            String t = part.trim();
            if (t.isEmpty()) continue;
            try {
                int id = Integer.parseInt(t);
                if (RATINGS.containsKey(id)) out.put(t, RATINGS.get(id));
            } catch (NumberFormatException ignored) { }
        }
        return out;
    }
}
```

- [ ] **Step 5: Build** — `cd ms-reviews && docker build -f Dockerfile.vercel -t ms-reviews .` (expect success).
- [ ] **Step 6: Run** — `docker run --rm -d -p 8083:80 --name ms-reviews ms-reviews && sleep 8`.
- [ ] **Step 7: Smoke test** — `cd ms-reviews && ./smoke-test.sh` → `All reviews smoke checks passed.`; then `docker stop ms-reviews`.

- [ ] **Step 8: Write `README.md`** — `ms-reviews/README.md`

```markdown
# ms-reviews

Spring Boot reviews microservice. Owns avg rating + review count (product id 1-12) in-memory.

## Endpoints
- `GET /health` → `{"status":"ok","service":"reviews"}`
- `GET /ratings?ids=1,2,3` → `{"1":{"avg":4.5,"count":128},...}`

## Local
    docker build -f Dockerfile.vercel -t ms-reviews .
    docker run --rm -d -p 8083:80 --name ms-reviews ms-reviews
    ./smoke-test.sh http://localhost:8083
    docker stop ms-reviews
```

- [ ] **Step 9: Commit**

```bash
git add ms-reviews
git commit -m "feat(ms-reviews): Spring Boot ratings service"
```

---

## Task 4: `ms-gateway` service (aggregator + fallback)

**Tokens:** `<svc>` = `gateway`, `<Svc>` = `Gateway`.

**Files:**
- Create: all skeleton files under `ms-gateway/` (tokens gateway/Gateway)
- Create: `ms-gateway/src/main/resources/application.properties` (skeleton + 3 service-URL lines, below)
- Create: `ms-gateway/src/main/java/com/example/gateway/SearchController.java` (below)
- Create: `ms-gateway/README.md`
- Test: `ms-gateway/smoke-test.sh`

**Interfaces:**
- Consumes: catalog `GET /products?q=&category=`, inventory `GET /stock?ids=`, reviews `GET /ratings?ids=` (Tasks 1–3), located via `CATALOG_URL` / `INVENTORY_URL` / `REVIEWS_URL`.
- Produces: `GET /health` → `{"status":"ok","service":"gateway"}`; `GET /api/search?q=&category=` → JSON array of `{id, name, category, price, description, stock:int|null, rating:{avg,count}|null}`. Consumed by `ms-web` (Task 5).

- [ ] **Step 1: Write the failing test** — `ms-gateway/smoke-test.sh`

```bash
#!/usr/bin/env bash
# Smoke test for ms-gateway. Usage: ./smoke-test.sh [base-url]
set -euo pipefail
BASE_URL="${1:-http://localhost:8080}"

echo "==> GET ${BASE_URL}/health"
curl -fsS --max-time 30 "${BASE_URL}/health" | grep -q '"service":"gateway"' \
  && echo "PASS: health" || { echo "FAIL: health"; exit 1; }

echo "==> GET ${BASE_URL}/api/search?q=headphones"
BODY="$(curl -fsS --max-time 30 "${BASE_URL}/api/search?q=headphones")"
echo "${BODY}"
echo "${BODY}" | grep -q 'Wireless Headphones' \
  && echo "${BODY}" | grep -q '"stock":42' \
  && echo "${BODY}" | grep -q '"avg":4.5' \
  && echo "PASS: aggregated search" || { echo "FAIL: aggregated search"; exit 1; }

echo "All gateway smoke checks passed."
```

Then `chmod +x ms-gateway/smoke-test.sh`.

- [ ] **Step 2: Run the test to verify it fails** — `cd ms-gateway && ./smoke-test.sh` → FAIL (connection refused).

- [ ] **Step 3: Create skeleton files** (tokens gateway/Gateway).

- [ ] **Step 4: Write `application.properties`** — `ms-gateway/src/main/resources/application.properties`

```properties
server.address=0.0.0.0
server.port=${PORT:80}
spring.application.name=gateway
services.catalog-url=${CATALOG_URL:http://localhost:8081}
services.inventory-url=${INVENTORY_URL:http://localhost:8082}
services.reviews-url=${REVIEWS_URL:http://localhost:8083}
```

- [ ] **Step 5: Write the controller** — `ms-gateway/src/main/java/com/example/gateway/SearchController.java`

```java
package com.example.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@RestController
public class SearchController {

    record Product(int id, String name, String category, double price, String description) {}
    record Rating(double avg, int count) {}
    record Enriched(int id, String name, String category, double price, String description,
                    Integer stock, Rating rating) {}

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper mapper;
    private final String catalogUrl;
    private final String inventoryUrl;
    private final String reviewsUrl;

    public SearchController(ObjectMapper mapper,
                            @Value("${services.catalog-url}") String catalogUrl,
                            @Value("${services.inventory-url}") String inventoryUrl,
                            @Value("${services.reviews-url}") String reviewsUrl) {
        this.mapper = mapper;
        this.catalogUrl = catalogUrl;
        this.inventoryUrl = inventoryUrl;
        this.reviewsUrl = reviewsUrl;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "gateway");
    }

    @GetMapping("/api/search")
    public List<Enriched> search(@RequestParam(defaultValue = "") String q,
                                 @RequestParam(required = false) String category) throws Exception {
        // 1) catalog is REQUIRED — failure propagates as a 500.
        String query = "q=" + enc(q) + (category != null ? "&category=" + enc(category) : "");
        String catalogBody = get(catalogUrl + "/products?" + query, Duration.ofSeconds(10));
        List<Product> products = Arrays.asList(mapper.readValue(catalogBody, Product[].class));
        if (products.isEmpty()) return List.of();

        String ids = products.stream().map(p -> String.valueOf(p.id()))
                .collect(Collectors.joining(","));

        // 2) inventory + reviews are BEST-EFFORT — fall back to empty maps.
        Map<String, Integer> stock = getStock(ids);
        Map<String, Rating> ratings = getRatings(ids);

        // 3) merge on id; missing downstream data becomes null.
        List<Enriched> out = new ArrayList<>();
        for (Product p : products) {
            String key = String.valueOf(p.id());
            out.add(new Enriched(p.id(), p.name(), p.category(), p.price(), p.description(),
                    stock.get(key), ratings.get(key)));
        }
        return out;
    }

    private Map<String, Integer> getStock(String ids) {
        try {
            String body = get(inventoryUrl + "/stock?ids=" + ids, Duration.ofSeconds(10));
            return mapper.readValue(body, mapper.getTypeFactory()
                    .constructMapType(HashMap.class, String.class, Integer.class));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Rating> getRatings(String ids) {
        try {
            String body = get(reviewsUrl + "/ratings?ids=" + ids, Duration.ofSeconds(10));
            return mapper.readValue(body, mapper.getTypeFactory()
                    .constructMapType(HashMap.class, String.class, Rating.class));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String get(String url, Duration timeout) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(timeout).GET().build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() / 100 != 2) {
            throw new RuntimeException("downstream " + url + " -> " + resp.statusCode());
        }
        return resp.body();
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
```

- [ ] **Step 6: Build** — `cd ms-gateway && docker build -f Dockerfile.vercel -t ms-gateway .` (expect success).

- [ ] **Step 7: Bring up all four containers for the integration test**

```bash
docker run --rm -d -p 8081:80 --name ms-catalog ms-catalog
docker run --rm -d -p 8082:80 --name ms-inventory ms-inventory
docker run --rm -d -p 8083:80 --name ms-reviews ms-reviews
docker run --rm -d -p 8080:80 --name ms-gateway \
  -e CATALOG_URL=http://host.docker.internal:8081 \
  -e INVENTORY_URL=http://host.docker.internal:8082 \
  -e REVIEWS_URL=http://host.docker.internal:8083 \
  ms-gateway
sleep 10
```

(`host.docker.internal` resolves to the host from inside the gateway container on Docker Desktop / macOS.)

- [ ] **Step 8: Smoke test — happy path** — `cd ms-gateway && ./smoke-test.sh` → `All gateway smoke checks passed.`

- [ ] **Step 9: Test the fallback path**

```bash
docker stop ms-reviews
sleep 1
curl -fsS "http://localhost:8080/api/search?q=headphones"
```

Expected: HTTP 200; JSON still contains `"stock":42` but `"rating":null` (reviews down → null, request survives). Then tear down: `docker stop ms-catalog ms-inventory ms-gateway`.

- [ ] **Step 10: Write `README.md`** — `ms-gateway/README.md`

```markdown
# ms-gateway

Stateless Spring Boot API gateway. Fans out to catalog, inventory, and reviews and merges results.
Inventory/reviews are best-effort (10s timeout, null fallback); catalog is required.

## Endpoints
- `GET /health` → `{"status":"ok","service":"gateway"}`
- `GET /api/search?q=&category=` → enriched product array (`stock`/`rating` may be null)

## Config (env)
- `CATALOG_URL`, `INVENTORY_URL`, `REVIEWS_URL` — base URLs of the downstream services.

## Local (all four containers)
See plan Task 4, Step 7 — run catalog/inventory/reviews, then gateway with
`*_URL=http://host.docker.internal:<port>`, then `./smoke-test.sh http://localhost:8080`.
```

- [ ] **Step 11: Commit**

```bash
git add ms-gateway
git commit -m "feat(ms-gateway): aggregating API gateway with resilient fan-out"
```

---

## Task 5: `ms-web` Next.js frontend

**Files:**
- Create: `ms-web/` via `create-next-app` (App Router, TS, Tailwind)
- Modify: `ms-web/app/page.tsx` (replace with search UI, below)
- Create: `ms-web/.env.local` (GATEWAY_URL for local)
- Modify: `ms-web/.gitignore` (ensure `.env*` ignored — create-next-app already does this; verify)
- Create: `ms-web/README.md`

**Interfaces:**
- Consumes: gateway `GET /api/search?q=&category=` (Task 4) via server-side `fetch` to `process.env.GATEWAY_URL`.
- Produces: the deployed search UI (end user surface).

- [ ] **Step 1: Scaffold Next.js (non-interactive)**

Run from repo root:
```bash
npx create-next-app@latest ms-web --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --turbopack
```
If any prompt remains, accept the default. Expected: `ms-web/` created with `app/page.tsx`, `app/layout.tsx`, Tailwind configured.

- [ ] **Step 2: Verify the dev server boots (baseline)**

Run: `cd ms-web && npm run dev` → open `http://localhost:3000`, confirm the default page renders, then Ctrl-C. (This is the pre-change smoke check; the real UI test is Step 6.)

- [ ] **Step 3: Set local env** — create `ms-web/.env.local`

```
GATEWAY_URL=http://localhost:8080
```

Confirm `.gitignore` contains `.env*` (create-next-app default). If missing, add a line `.env*`.

- [ ] **Step 4: Replace the page** — `ms-web/app/page.tsx`

```tsx
type Rating = { avg: number; count: number };
type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  stock: number | null;
  rating: Rating | null;
};

const CATEGORIES = ["", "Electronics", "Home", "Sports"];

async function search(q: string, category: string): Promise<Product[]> {
  const base = process.env.GATEWAY_URL;
  if (!base) throw new Error("GATEWAY_URL is not set");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const res = await fetch(`${base}/api/search?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`gateway responded ${res.status}`);
  return res.json();
}

function StockBadge({ stock }: { stock: number | null }) {
  if (stock === null) return <span className="text-xs text-gray-400">stock unavailable</span>;
  if (stock === 0) return <span className="text-xs font-medium text-red-600">Out of stock</span>;
  return <span className="text-xs font-medium text-green-600">{stock} in stock</span>;
}

function Stars({ rating }: { rating: Rating | null }) {
  if (rating === null) return <span className="text-xs text-gray-400">no rating</span>;
  const full = Math.round(rating.avg);
  return (
    <span className="text-xs text-amber-500">
      {"★".repeat(full)}
      <span className="text-gray-300">{"★".repeat(5 - full)}</span>
      <span className="ml-1 text-gray-500">
        {rating.avg.toFixed(1)} ({rating.count})
      </span>
    </span>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q = "", category = "" } = await searchParams;
  let products: Product[] = [];
  let error: string | null = null;
  try {
    products = await search(q, category);
  } catch (e) {
    error = e instanceof Error ? e.message : "search failed";
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Product Search</h1>
      <p className="mt-1 text-sm text-gray-500">
        Next.js → Spring Boot gateway → catalog + inventory + reviews microservices on Vercel.
      </p>

      <form className="mt-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products…"
          className="flex-1 min-w-[240px] rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          name="category"
          defaultValue={category}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c || "all"} value={c}>
              {c || "All categories"}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Search failed: {error}
        </p>
      )}

      {!error && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <article key={p.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{p.name}</h2>
                <span className="whitespace-nowrap text-sm font-semibold">
                  ${p.price.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">{p.category}</p>
              <p className="mt-2 text-sm text-gray-600">{p.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <StockBadge stock={p.stock} />
                <Stars rating={p.rating} />
              </div>
            </article>
          ))}
          {products.length === 0 && (
            <p className="text-sm text-gray-500">No products found.</p>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Bring up the backend for a live test**

Run the four containers (Task 4, Step 7). Leave them running for Step 6.

- [ ] **Step 6: Manual end-to-end verification**

Run: `cd ms-web && npm run dev`. Open `http://localhost:3000`.
Expected: product grid renders. Search `keyboard` → only Mechanical Keyboard. Category `Sports` → sports items. Each card shows a stock badge and star rating. Stop `ms-reviews` container and reload → cards show "no rating" but still render (fallback). Ctrl-C the dev server; `docker stop ms-catalog ms-inventory ms-gateway` (reviews already stopped).

- [ ] **Step 7: Lint/build check**

Run: `cd ms-web && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 8: Write `README.md`** — `ms-web/README.md`

```markdown
# ms-web

Next.js (App Router) frontend for the microservices demo. Server-side calls the gateway.

## Config (env)
- `GATEWAY_URL` — base URL of ms-gateway (e.g. http://localhost:8080 locally).

## Local
Bring up the four Spring Boot containers (see ms-gateway README), set `GATEWAY_URL`
in `.env.local`, then:
    npm install
    npm run dev   # http://localhost:3000
```

- [ ] **Step 9: Commit**

```bash
git add ms-web
git commit -m "feat(ms-web): Next.js search frontend calling the gateway"
```

---

## Task 6: Full Vercel deployment, env wiring, and top-level docs

Deploys the remaining services (catalog already live from Task 1), wires cross-project env vars, and verifies end-to-end in production.

**Files:**
- Create: top-level `MICROSERVICES.md` (architecture + deploy runbook)
- Modify: memory `MEMORY.md` index if a new memory is added

**Interfaces:**
- Consumes: live prod URLs of all five projects.
- Produces: a working end-to-end production deployment.

- [ ] **Step 1: Deploy inventory + reviews**

```bash
cd ms-inventory && vercel link && vercel deploy --prod && ./smoke-test.sh <inventory-prod-url>
cd ../ms-reviews  && vercel link && vercel deploy --prod && ./smoke-test.sh <reviews-prod-url>
```
Record both prod URLs.

- [ ] **Step 2: Deploy the gateway and wire downstream URLs**

```bash
cd ../ms-gateway && vercel link
printf '%s' '<catalog-prod-url>'   | vercel env add CATALOG_URL production
printf '%s' '<inventory-prod-url>' | vercel env add INVENTORY_URL production
printf '%s' '<reviews-prod-url>'   | vercel env add REVIEWS_URL production
vercel deploy --prod
./smoke-test.sh <gateway-prod-url>
```
Expected: `All gateway smoke checks passed.` (Note: first hit may be slow — cold JVM fan-out.)

- [ ] **Step 3: Deploy the frontend and wire the gateway URL**

```bash
cd ../ms-web && vercel link
printf '%s' '<gateway-prod-url>' | vercel env add GATEWAY_URL production
vercel deploy --prod
```

- [ ] **Step 4: Production end-to-end verification**

Open the `ms-web` prod URL in a browser. Confirm: grid renders, `q`/category filtering works, stock badges + star ratings appear. (First load after idle may take a few seconds while JVMs cold-start — expected.)

- [ ] **Step 5: Write the top-level runbook** — `MICROSERVICES.md`

Document: the architecture diagram (web → gateway → catalog/inventory/reviews), the five Vercel projects and their root directories, the full env-var wiring table (`CATALOG_URL`/`INVENTORY_URL`/`REVIEWS_URL` on gateway, `GATEWAY_URL` on web), the ordered deploy runbook (catalog → inventory/reviews → gateway → web), and the cold-start/scale-to-zero talking point. Include the local "run all four containers" recipe from Task 4 Step 7.

- [ ] **Step 6: Commit**

```bash
git add MICROSERVICES.md
git commit -m "docs: microservices architecture + deploy runbook"
```

- [ ] **Step 7: Push and open a PR**

```bash
git push -u origin feat/java-microservices-vercel
```
Then open a PR to `main` summarizing the demo (5 Vercel projects, Java microservices proven end-to-end).

---

## Self-review notes

- **Spec coverage:** topology (Tasks 1–5), gateway fan-out + fallback (Task 4 Steps 8–9), in-memory DB-per-service (Tasks 1–3), shared IDs 1–12 (enforced in all three data services), resilience/timeouts (Task 4 controller), manual env wiring (Task 6), smoke tests per service, de-risk-catalog-first (Task 1 gate), frontend graceful nulls (Task 5 `StockBadge`/`Stars`), scope guards (no auth/persistence/etc.) — all covered.
- **Type consistency:** `Enriched` (gateway) field names/types match the `Product` TS type (web) and the smoke-test assertions (`"stock":42`, `"avg":4.5`). Downstream response shapes (`{"1":42}`, `{"1":{"avg,count}}`) match the gateway's Jackson `constructMapType` parsing.
- **No placeholders:** every code/config file is given in full or via the explicitly-tokenized Shared Skeleton.
