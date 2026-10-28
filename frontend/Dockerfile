# Multi-stage image for the Next.js frontend (next start, non-root).
# Build: docker build -t vaxclinic/frontend frontend
# Runtime env: GATEWAY_URL (e.g. http://gateway-service:8080), COOKIE_SECURE (true behind HTTPS).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# lockfile is written by npm 11 (dev machine); Node 22 ships npm 10
RUN --mount=type=cache,target=/root/.npm npm install -g npm@11.6.2 --no-audit --no-fund \
    && npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_* are inlined at build time; override with --build-arg.
ARG NEXT_PUBLIC_APP_NAME=VaxClinic
ARG NEXT_PUBLIC_SUPPORT_PHONE=
ARG NEXT_PUBLIC_STORE_DOMAIN=
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_SUPPORT_PHONE=$NEXT_PUBLIC_SUPPORT_PHONE \
    NEXT_PUBLIC_STORE_DOMAIN=$NEXT_PUBLIC_STORE_DOMAIN \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.ts ./
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
