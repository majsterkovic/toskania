FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY trip.json trip.config.js ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/distance-matrix.json ./src/distance-matrix.json
EXPOSE 3000
CMD ["node", "server/index.js"]
