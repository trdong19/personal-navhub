# ---- Build Stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server.mjs ./

RUN mkdir -p data

ENV PORT=8888
ENV HOST=0.0.0.0
EXPOSE 8888

VOLUME ["/app/data"]

CMD ["node", "server.mjs"]
