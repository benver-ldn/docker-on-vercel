# docker-sandbox-express

A minimal Express HTTP server, packaged in Docker, for testing Docker image execution on Vercel Functions and Vercel Sandboxes.

## Endpoints

| Method | Path     | Response                                            |
| ------ | -------- | --------------------------------------------------- |
| GET    | `/`      | JSON service info / health check                    |
| GET    | `/image` | `{ "imageUrl": "<random Unsplash image URL>" }`     |
| POST   | `/`      | `200` `{ "ok": true, "message": "POST received..." }` |

The server listens on `PORT` (default `3000`) and binds `0.0.0.0`.

## Run locally (Node)

```bash
npm install
npm start
# GET  http://localhost:3000/image
# POST http://localhost:3000/
```

## Run with Docker

```bash
docker build -t docker-sandbox-express .
docker run -p 3000:3000 docker-sandbox-express
```

Override the port:

```bash
docker run -e PORT=8080 -p 8080:8080 docker-sandbox-express
```

## Quick test

```bash
curl localhost:3000/image
curl -X POST localhost:3000/ -H 'Content-Type: application/json' -d '{"hi":1}'
```

## Notes

- Image URLs are served from a curated list of real Unsplash CDN URLs, so there are
  no API keys or secrets to provide — it runs anywhere Docker runs.
