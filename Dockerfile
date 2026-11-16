# budgettrackerdense on Coolify (docs/plans/08-deploy-coolify.md).
#
# Every stage is node:24-alpine with openssl: prisma/schema.prisma is generated
# from budgettracker and names no binaryTargets, so the query engine must be
# generated on the same base it runs on. Nothing here migrates or touches the
# database; the build uses a placeholder DATABASE_URL.

FROM node:24-alpine AS base
RUN apk add --no-cache openssl libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
# pnpm at the version package.json pins (packageManager).
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# prisma generate && next build. Neither connects; the URL only has to parse.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm build

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3200 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3200
CMD ["node", "server.js"]
