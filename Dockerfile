FROM node:20-slim AS base

WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/shared ./shared
COPY --from=build /app/drizzle.config.ts ./

ENV NODE_ENV=production

CMD ["sh", "-c", "npx -y -p drizzle-kit@0.31.4 drizzle-kit push --force && node dist/index.cjs"]
