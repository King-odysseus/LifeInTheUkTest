# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# The question bank is gated here: a malformed entry fails the deploy rather
# than reaching a live exam.
RUN npm run questions:validate && npm run build

# ---------- runtime ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# The server is bundled to a single file, so the only runtime dependency is the
# Postgres driver. React, Vite, tsx and the rest of the toolchain stay in the
# build stage and never ship.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund pg@^8.13.1 \
 && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

EXPOSE 8080
CMD ["node", "dist-server/index.js"]
