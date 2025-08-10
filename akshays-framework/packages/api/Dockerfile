FROM node:20-alpine as deps
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
COPY prisma ./prisma
RUN npm install --omit=dev && npm cache clean --force

FROM node:20-alpine as build
WORKDIR /app
COPY packages/api ./packages/api
COPY --from=deps /app/node_modules ./node_modules
RUN cd packages/api && npm install && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/api/dist ./dist
COPY --from=build /app/packages/api/package.json ./package.json
COPY --from=deps /app/prisma ./prisma
RUN npm i --omit=dev && npx prisma generate --schema=./prisma/schema.prisma
EXPOSE 4000
CMD ["node", "dist/index.js"]