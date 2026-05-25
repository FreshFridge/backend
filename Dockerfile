FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY src/docs ./src/docs

EXPOSE 3000

CMD ["npm", "run", "start"]
