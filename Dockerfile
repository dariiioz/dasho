# Image de production Dasho : build Next.js standalone puis runtime non-root.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_URL=/data/dasho.db

# Les migrations Drizzle sont exécutées au démarrage. Le CLI et ses dépendances
# sont donc conservés dans l'image runtime (elles ne sont jamais exposées au web).
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/db ./src/db
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data /app/.next/cache \
  && chown -R node:node /data /app/.next/cache \
  && chmod +x /app/docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
