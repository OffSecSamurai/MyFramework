FROM node:20-alpine AS builder
WORKDIR /app
COPY ../../package.json ../../pnpm-lock.yaml* ./
RUN apk add --no-cache curl && curl -fsSL https://get.pnpm.io/install.sh | sh -
ENV PATH="/root/.local/share/pnpm:${PATH}"
RUN pnpm install --frozen-lockfile
COPY ../../ .
RUN pnpm --filter @afw/worker build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/worker/dist ./dist
COPY --from=builder /root/.local/share/pnpm /root/.local/share/pnpm
ENV PATH="/root/.local/share/pnpm:${PATH}"
RUN pnpm install --prod --filter @afw/worker
CMD ["node", "dist/index.js"]