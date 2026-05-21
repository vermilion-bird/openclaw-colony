import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/openclaw_colony'

  // SQLite: file: prefix or .db extension
  if (url.startsWith('file:') || url.includes('.db')) {
    const adapter = new PrismaBetterSqlite3({ url })
    return new PrismaClient({ adapter })
  }

  // PostgreSQL: postgresql:// prefix
  const pool = new Pool({ connectionString: url })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma