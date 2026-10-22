FROM node:22.22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY server.js ./
COPY src ./src
COPY scripts ./scripts
COPY catalog ./catalog
COPY public ./public

# База и фото лежат в /app/data — этот каталог подключается томом и переживает пересборку
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

ENV PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/products >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
