FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
WORKDIR /app
COPY package.json bun.lock ./
ENV HUSKY=0
RUN bun install --frozen-lockfile --network-concurrency 8
COPY . .
RUN bun run typecheck && bun run lint && bun run build

FROM build AS production-dependencies
RUN rm -rf node_modules && bun install --production --frozen-lockfile --ignore-scripts --network-concurrency 8

FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS runtime
WORKDIR /app
ARG OFFICE_TRACKER_REVISION=development
LABEL org.opencontainers.image.source="https://github.com/kylescudder/thursday-office-tracker" \
      org.opencontainers.image.revision="${OFFICE_TRACKER_REVISION}"
ENV NODE_ENV=production PORT=3000 TZ=Europe/London
ENV OFFICE_TRACKER_REVISION=${OFFICE_TRACKER_REVISION}
COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --chown=bun:bun drizzle ./drizzle
COPY --chown=bun:bun server/index.ts server/migrate.ts ./server/
COPY --chown=bun:bun src/server ./src/server
COPY --chown=bun:bun deploy/verify.ts deploy/database.ts ./deploy/
USER bun
EXPOSE 3000
# Health ownership: deploy/healthcheck.md at the repository root.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:3000/healthz', { signal: AbortSignal.timeout(3000) }); if (!r.ok || (await r.json()).ok !== true) process.exit(1)"]
CMD ["bun", "server/index.ts"]
