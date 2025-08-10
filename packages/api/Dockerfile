FROM node:20-alpine AS builder
WORKDIR /app
COPY ../../package.json ../../pnpm-lock.yaml* ./
RUN apk add --no-cache curl && curl -fsSL https://get.pnpm.io/install.sh | sh -
ENV PATH="/root/.local/share/pnpm:${PATH}"
RUN pnpm install --frozen-lockfile
COPY ../../ .
RUN pnpm --filter @afw/api build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /root/.local/share/pnpm /root/.local/share/pnpm
ENV PATH="/root/.local/share/pnpm:${PATH}"
RUN pnpm install --prod --filter @afw/api
CMD ["node", "dist/app.js"]