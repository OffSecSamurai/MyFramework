FROM node:20-alpine AS builder
WORKDIR /app
COPY ../../ ./
RUN npm install -g pnpm@10.14.0
ENV SHELL=/bin/sh
RUN pnpm install --no-frozen-lockfile
RUN pnpm dlx prisma generate
RUN pnpm --filter @afw/api build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/api/dist ./dist
RUN npm install -g pnpm@10.14.0
RUN pnpm install --prod --filter @afw/api
CMD ["node", "dist/app.js"]