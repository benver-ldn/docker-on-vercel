# Small, production-ready base.
FROM node:20-alpine

WORKDIR /app

# Install deps first so this layer is cached unless package files change.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy the rest of the app.
COPY . .

# The server reads PORT from the environment; default to 3000.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
