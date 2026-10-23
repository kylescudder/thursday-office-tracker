ARG BUN_IMAGE=oven/bun@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d
FROM ${BUN_IMAGE} AS build
WORKDIR /app
COPY package.json bun.lock ./
ENV HUSKY=0
RUN bun install --frozen-lockfile --network-concurrency 8
COPY . .
RUN bun run typecheck && bun run lint && bun run build

FROM ${BUN_IMAGE} AS runtime
WORKDIR /app
ARG OFFICE_TRACKER_REVISION=development
LABEL org.opencontainers.image.source="https://github.com/kylescudder/thursday-office-tracker" \
      org.opencontainers.image.revision="${OFFICE_TRACKER_REVISION}"
ENV NODE_ENV=production PORT=3000 TZ=Europe/London
ENV OFFICE_TRACKER_REVISION=${OFFICE_TRACKER_REVISION}
COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --chown=bun:bun server/database.ts server/index.ts server/migrate.ts ./server/
COPY --chown=bun:bun deploy/verify.ts ./deploy/
USER bun
EXPOSE 3000
CMD ["bun", "server/index.ts"]
