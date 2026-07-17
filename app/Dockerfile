# Multi-stage build for the stoix-cloud-saver app.
# The same image is deployed identically to AWS, DigitalOcean and OCI; cloud
# identity is injected at runtime via environment variables, never baked in.
#
# Reproducibility is a first-class requirement here: the base image is pinned by
# digest and dependencies are installed with `npm ci` from the committed
# lockfile, so the exact same bytes build everywhere.
#
# Build context is the repository ROOT (the npm workspaces lockfile lives there):
#   docker build -f app/Dockerfile -t stoix-cloud-saver .

# Builder stage: install all deps and compile TypeScript to app/dist.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder
WORKDIR /repo

# Deterministic install from the committed root lockfile. Copy only the manifests
# first so this layer caches until a dependency actually changes.
COPY package.json package-lock.json ./
COPY app/package.json ./app/package.json
RUN npm ci

# Compile the app workspace.
COPY app/tsconfig.json ./app/tsconfig.json
COPY app/src ./app/src
RUN npm run build --workspace app

# Runtime stage: production deps + compiled output only, run as non-root.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=8080

# Build-time identity, surfaced to the app as env so it can report itself.
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ENV APP_VERSION=${APP_VERSION}
ENV GIT_COMMIT=${GIT_COMMIT}

# Deterministic production-only install (drops typescript/tsx/vitest).
COPY package.json package-lock.json ./
COPY app/package.json ./app/package.json
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=builder /repo/app/dist ./app/dist

USER node
WORKDIR /repo/app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "dist/index.js"]
