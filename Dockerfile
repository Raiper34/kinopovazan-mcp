# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json xmcp.config.ts ./
COPY src ./src
# xmcp bakes the HTTP host/port into the bundle at build time.
ENV MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3001
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    TZ=Europe/Bratislava
# The xmcp build output in dist/ is self-contained (no node_modules needed).
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3001/ || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
# "http" (default) or "stdio"
CMD ["http"]
