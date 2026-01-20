FROM node:24.11.0-alpine

WORKDIR /app

# pnpm via corepack
RUN corepack enable

# Instala dependencias usando lockfile (mejor cache)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copia el código
COPY . .

# Puerto de tu app
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js"]
