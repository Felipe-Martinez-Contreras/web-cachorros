# syntax=docker/dockerfile:1.7
# Imagen web (Next.js standalone: sitio + panel + API). Se construye en CI, nunca en la VM,
# y no depende del entorno: la misma imagen sirve para staging y producción.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Las dependencias se instalan dentro de la imagen (musl): nunca se copia node_modules del host.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_ENV_VALIDATION=1
# next build (standalone, sin BD) + scripts de consola empaquetados con esbuild
RUN pnpm build && pnpm build:scripts

FROM node:${NODE_VERSION}-alpine AS runner
ARG REVISION=desconocida
LABEL org.opencontainers.image.title="cachorros-web" \
      org.opencontainers.image.description="Sitio web del Club Deportivo Los Cachorros" \
      org.opencontainers.image.source="https://github.com/Felipe-Martinez-Contreras/web-cachorros" \
      org.opencontainers.image.revision="${REVISION}"
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 UPLOADS_DIR=/data/uploads
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app \
 && mkdir -p /data/uploads /data/cache/share && chown -R app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/dist/scripts ./scripts
COPY --from=build --chown=app:app /app/drizzle ./drizzle
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
