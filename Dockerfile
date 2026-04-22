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
# Install production deps + drizzle-kit for migrations
RUN npm ci --omit=dev && npm install drizzle-kit@0.31.10 --no-save
COPY --from=build /app/dist ./dist
COPY --from=build /app/shared ./shared
COPY drizzle.config.ts ./
COPY start.sh ./
RUN chmod +x start.sh

ENV NODE_ENV=production

CMD ["./start.sh"]
