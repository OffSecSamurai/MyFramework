# build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY ../../package.json ../../pnpm-lock.yaml* ./
RUN apk add --no-cache curl && curl -fsSL https://get.pnpm.io/install.sh | sh -
ENV PATH="/root/.local/share/pnpm:${PATH}"
RUN pnpm install --frozen-lockfile
COPY ../../ .
RUN pnpm --filter @afw/web build

# production
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/packages/web/dist .
COPY --from=builder /app/packages/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]