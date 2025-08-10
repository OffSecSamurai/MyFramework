FROM node:20-alpine AS builder
WORKDIR /app
COPY ../../ ./
RUN npm install -g pnpm@10.14.0
ENV SHELL=/bin/sh
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @afw/worker build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/worker/dist ./dist
RUN npm install -g pnpm@10.14.0
RUN pnpm install --prod --filter @afw/worker
CMD ["node", "dist/index.js"]