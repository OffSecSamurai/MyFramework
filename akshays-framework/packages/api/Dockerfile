FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
COPY packages/api/package.json ./packages/api/
COPY prisma ./prisma
RUN npm install --omit=dev --workspaces=false && npm cache clean --force

FROM node:20-alpine as build
WORKDIR /app
COPY . .
RUN npm install && npm run -w packages/api build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/api/dist ./dist
COPY --from=build /app/packages/api/package.json ./package.json
COPY --from=build /app/prisma ./prisma
RUN npm i --omit=dev && npx prisma generate --schema=./prisma/schema.prisma
EXPOSE 4000
CMD ["node", "dist/index.js"]