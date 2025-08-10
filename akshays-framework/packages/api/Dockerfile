FROM node:20-alpine as build
WORKDIR /app
COPY packages/api ./packages/api
COPY prisma ./prisma
RUN cd packages/api && npm install && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/api/dist ./dist
COPY --from=build /app/packages/api/package.json ./package.json
COPY --from=build /app/prisma ./prisma
RUN npm i --omit=dev && npx -y prisma@5.22.0 generate --schema=./prisma/schema.prisma
EXPOSE 4000
CMD ["node", "dist/index.js"]