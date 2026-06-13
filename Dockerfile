# syntax=docker/dockerfile:1

# ── deps: install everything once (cached unless package*.json changes) ───────
FROM node:22-alpine AS deps
WORKDIR /app
# node:22 ships npm 10.9.x, which hard-fails `npm ci` on non-matching optional
# platform packages (e.g. @esbuild/aix-ppc64); npm 11 skips them correctly.
RUN npm i -g npm@11
COPY package.json package-lock.json ./
RUN npm ci

# ── dev: full source + all deps, used by docker-compose.dev.yml (next dev) ────
# Source is bind-mounted over /app at runtime; node_modules stays from the image.
FROM node:22-alpine AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npx", "next", "dev", "-H", "0.0.0.0", "-p", "3000"]

# ── builder: produce the standalone production bundle ─────────────────────────
# Also serves as the `migrate` image — it still has drizzle-kit + drizzle.config
# + db/migrations, so `npm run db:migrate` works here (the runner stage is too
# lean to run drizzle-kit).
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runner: minimal production image (just the standalone server) ─────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
# server.js + traced node_modules live at the root of .next/standalone.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
