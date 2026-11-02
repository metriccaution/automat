FROM node:24-alpine AS build

WORKDIR /app

# Dev dependencies (sass) are only needed to compile the stylesheet
COPY package.json package-lock.json ./
RUN npm ci

COPY styles/ ./styles/
RUN npm run build:css

FROM node:24-alpine

WORKDIR /app

# Runtime deps only — node runs the TypeScript directly
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.ts tsconfig.json ./
COPY lib/ ./lib/
COPY public/ ./public/
COPY --from=build /app/public/css/ ./public/css/
# Seed for the one-time import into the database (removed in Phase 5)
COPY meals/ ./meals/

# /data must be a mounted directory (not a single file), so SQLite's journal
# lives alongside the database
ENV DB_PATH=/data/automat.sqlite \
    PORT=3000 \
    TZ=Europe/London
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- --header="Host: localhost" http://127.0.0.1:3000/healthz || exit 1

# TODOIST_TOKEN must be passed in at runtime (never bake secrets into the image)
CMD ["node", "server.ts"]
