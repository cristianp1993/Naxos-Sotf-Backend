FROM node:24.11.0-alpine
WORKDIR /app

# Instalar tzdata para soporte de zona horaria y configurar Colombia
RUN apk add --no-cache libc6-compat python3 make g++ tzdata \
  && corepack enable \
  && cp /usr/share/zoneinfo/America/Bogota /etc/localtime \
  && echo "America/Bogota" > /etc/timezone

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV PORT=3000
ENV TZ=America/Bogota
EXPOSE 3000

CMD ["node", "src/index.js"]
