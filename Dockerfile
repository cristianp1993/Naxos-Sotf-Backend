FROM node:24.11.0-alpine
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++ \
  && corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js"]
