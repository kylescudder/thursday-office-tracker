ARG BUN_IMAGE=oven/bun@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598
FROM ${BUN_IMAGE} AS build
WORKDIR /app
COPY package.json bun.lock ./
ENV HUSKY=0
RUN bun install --frozen-lockfile --network-concurrency 8
COPY . .
RUN bun run build

FROM ${BUN_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 TZ=Europe/London
COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --chown=bun:bun server ./server
USER bun
EXPOSE 3000
CMD ["bun", "server/index.ts"]
