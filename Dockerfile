FROM node:20-alpine AS deps
WORKDIR /app
# Install native build dependencies for both SQLite and PostgreSQL
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
# Set DATABASE_URL for Prisma during build (placeholder for schema validation)
# Build process will auto-select schema based on DATABASE_URL format
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?connect_timeout=1"
RUN apk add --no-cache python3 make g++ libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Runtime dependencies for both SQLite and PostgreSQL adapters
RUN apk add --no-cache libc6-compat

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy node_modules for prisma and database adapters
COPY --from=builder /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]