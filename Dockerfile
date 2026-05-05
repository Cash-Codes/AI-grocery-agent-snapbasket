# syntax=docker/dockerfile:1.7

# ============================================================================
# Stage 1: deps - install all dependencies (incl. devDeps for the build stage).
# Cached on pnpm-lock.yaml so this layer rebuilds only when deps change.
# ============================================================================
FROM node:22-slim AS deps

# Enable pnpm via corepack (ships with Node 22, no extra install).
RUN corepack enable

WORKDIR /app

# Copy lockfile + manifest + workspace config first so this layer cache-hits
# when source changes but deps don't.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# `--frozen-lockfile` matches CI behaviour: fail fast on lockfile drift.
# Native modules (better-sqlite3) get prebuilt binaries on linux-x64-gnu.
# `--config.node-linker=hoisted` flattens node_modules to npm-style layout
# (just for this Docker build - local dev keeps pnpm's isolated symlink layout).
# Without this, transitive deps like `bindings` and `file-uri-to-path` live in
# `.pnpm/<pkg>@<version>/...` with version-pinned paths that drift on lockfile bumps.
RUN pnpm install --frozen-lockfile --config.node-linker=hoisted

# ============================================================================
# Stage 2: build - copy source and run pnpm build.
# Produces .next/standalone (server) and .next/static (assets).
# ============================================================================
FROM node:22-slim AS build

RUN corepack enable

WORKDIR /app

# Reuse installed node_modules from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy everything else. .dockerignore excludes data/, .git, tests/, etc.
COPY . .

# Build-time NODE_ENV. Has no bearing on runtime.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ============================================================================
# Stage 3: runtime - slim final image. Standalone output means we don't need
# node_modules in the runtime stage; Next.js bundled its server dependencies.
# ============================================================================
FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run injects PORT; default to 3000 for local docker run.
ENV PORT=3000
# Bind to all interfaces - Cloud Run requires this.
ENV HOSTNAME=0.0.0.0

# Run as a non-root user, standard hardening on container images.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Copy public assets (images served from /public).
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Copy Next.js standalone bundle (server.js, .next/server, etc.) and static assets.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# better-sqlite3's native binary lives in node_modules. Standalone bundles
# import paths but NOT prebuilt native artifacts; copy the package across.
# The deps stage uses --config.node-linker=hoisted so these all live at
# top-level node_modules (no .pnpm/<pkg>@<version> indirection to chase).
COPY --from=build --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
# bindings is a transitive dep that better-sqlite3 needs at runtime.
COPY --from=build --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
# file-uri-to-path is bindings' only runtime dep.
COPY --from=build --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Migrations need to run on the ephemeral disk. Drizzle reads from /app/drizzle.
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs

EXPOSE 3000

# server.js comes from .next/standalone - it's the Next.js production server.
CMD ["node", "server.js"]
