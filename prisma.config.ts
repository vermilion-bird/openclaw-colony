import { config } from 'dotenv'
import path from 'path'
import { defineConfig, env } from 'prisma/config'

// Load .env.local for Prisma CLI (Next.js doesn't auto-load it for CLI tools)
config({ path: path.resolve(process.cwd(), '.env.local') })

const url = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/openclaw_colony'

// SQLite: file: prefix or .db extension
const isSQLite = url.startsWith('file:') || url.includes('.db')

export default defineConfig({
  schema: isSQLite ? 'prisma/schema-sqlite.prisma' : 'prisma/schema-postgresql.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})