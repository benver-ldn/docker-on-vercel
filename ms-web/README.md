# ms-web

## Purpose

ms-web is the frontend of the Java microservice demo. It is a Next.js application. It shows a product search interface. A user can search for products. A user can also open a page for one product.

ms-web does not hold data. It sends each request to the gateway service. The gateway service is `ms-gateway`. The gateway sends requests to three services: catalog, inventory, and reviews. The gateway merges the results. Then ms-web shows the merged data.

## Architecture

ms-web sends all requests from the server. This keeps the gateway address on the server. This also prevents browser CORS errors.

The request flow is:

1. The browser opens a page in ms-web.
2. ms-web sends a request to the gateway.
3. The gateway sends requests to the catalog, inventory, and reviews services.
4. The gateway merges the data. The gateway sends the data back to ms-web.
5. ms-web shows the data.

If the inventory service or the reviews service does not answer, the gateway sends the product with an empty value for that field. The page then shows "stock —" or "no rating". The search does not fail.

## Pages

- `/` is the search page. It shows a search box, a category filter, and a grid of product cards.
- `/product/[id]` is the product page. It shows the details of one product.
- The not-found page shows a message when a product id does not exist.

Each page shows a skeleton loader while it waits for data.

## Technology

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4

The pages are React Server Components. The design tokens are in `design.md` and `tokens.css`.

## Environment variable

ms-web needs one environment variable:

- `GATEWAY_URL` is the base address of the gateway service. An example is `http://localhost:8080`.

Set this variable on the server. Do not add the `NEXT_PUBLIC_` prefix. This keeps the address on the server.

## Run ms-web on your computer

Before you start:

- Install Node.js version 20 or later.
- The gateway must run. The gateway needs the catalog, inventory, and reviews services. Read the `ms-gateway` README for the steps.

Then do these steps:

1. Make a file with the name `.env.local` in this directory.
2. Add this line to the file:
   ```
   GATEWAY_URL=http://localhost:8080
   ```
3. Install the dependencies:
   ```
   npm install
   ```
4. Start the development server:
   ```
   npm run dev
   ```
5. Open `http://localhost:3000` in a browser.

## Build ms-web

To make a production build, do this command:

```
npm run build
```

To start the production server after the build, do this command:

```
npm run start
```

## Deploy ms-web to Vercel

ms-web is one Vercel project. The root directory is this folder.

Do these steps:

1. Set the `GATEWAY_URL` environment variable in the Vercel project. Use the production address of the gateway.
2. Deploy the project:
   ```
   vercel deploy --prod
   ```

## More information

For the full architecture and the deploy order of all services, read `MICROSERVICES.md` in the root
of the repository.

---

*This document uses ASD-STE100 Simplified Technical English.*
