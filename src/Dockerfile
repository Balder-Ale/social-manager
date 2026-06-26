FROM node:18-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# copy only package files first for layer caching
COPY package.json .
COPY pnpm-lock.yaml* .

# install pnpm globally (npm is already present)
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# copy the rest of the source
COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=prisma/schema.prisma

# build TypeScript
RUN pnpm run build

EXPOSE 3000

# start the dev server (ts-node) – in prod you could use "npm start"
CMD ["pnpm", "run", "dev"]
