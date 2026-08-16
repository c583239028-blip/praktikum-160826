FROM node:24-bookworm

# WHY python3-pip: when mediasoup can't fetch its prebuilt worker binary (e.g. a
# transient github failure), its postinstall falls back to compiling the worker
# from source, which shells out to `python3 -m pip install invoke`. Without pip the
# fallback dies with "No module named pip" and the whole build fails (SCRUM-349).
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# 1. העתקת קבצי הגדרות
COPY package.json ./
COPY packages/media-server/package*.json ./packages/media-server/
COPY packages/shared/ ./packages/shared/
COPY packages/server/prisma ./packages/server/prisma

# יצירת תיקיית הסטרימינג ומתן הרשאות מלאות
RUN mkdir -p public/streams && chmod -R 777 public/streams

# WHY: the two build steps below download binaries over HTTPS (mediasoup's prebuilt
# worker from github; prisma's query-engine from binaries.prisma.sh). Behind a
# TLS-intercepting proxy such as Netfree the container lacks the proxy CA and the
# downloads fail. BUILD_TLS_INSECURE opts out of TLS verification for those downloads
# ONLY, and is never set in the container runtime (SCRUM-298 / M11-14).
#   - Default empty  => prod/droplet builds keep full TLS verification (real CAs).
#   - Local behind Netfree: build with `--build-arg BUILD_TLS_INSECURE=1`.
ARG BUILD_TLS_INSECURE=""

# 2. התקנה
# env-prefix (not a bare VAR= prefix): a shell-expanded assignment is parsed as a
# command name, so `env` is what actually sets the var for this process only.
# WHY PIP_BREAK_SYSTEM_PACKAGES: Debian bookworm marks the base env externally-managed
# (PEP 668), so mediasoup's source-build fallback `pip install` is refused unless we
# opt out. Scoped to this build step only; no effect at runtime.
RUN env ${BUILD_TLS_INSECURE:+NODE_TLS_REJECT_UNAUTHORIZED=0} PIP_BREAK_SYSTEM_PACKAGES=1 npm install

# 3. יצירת פריזמה בשרת המדיה (זה מה שהיה חסר!)
RUN env ${BUILD_TLS_INSECURE:+NODE_TLS_REJECT_UNAUTHORIZED=0} npx prisma generate --schema=./packages/server/prisma/schema.prisma

# 4. העתקת שאר הקוד
COPY packages/media-server/ ./packages/media-server/

WORKDIR /usr/src/app/packages/media-server

# פתיחת טווח הפורטים ל-UDP (אופציונלי ב-Dockerfile, חובה ב-Compose)
EXPOSE 10000-10079/udp

EXPOSE 8000
CMD ["npm", "start"]