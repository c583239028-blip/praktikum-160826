FROM node:24-alpine
WORKDIR /usr/src/app

# התקנת תשתיות דרושות - שימוש ב-apk עבור Alpine
# הוספנו את ffmpeg כאן
RUN apk add --no-cache openssl ffmpeg bash curl

COPY package.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/shared/package*.json ./packages/shared/

RUN npm install

COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

WORKDIR /usr/src/app/packages/server

EXPOSE 8080

CMD ["sh", "-c", "npx prisma generate --schema=./prisma/schema.prisma && npx prisma migrate deploy && npm run start:cloud"]