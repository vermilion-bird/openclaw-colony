import { config } from 'dotenv'
import path from 'path'
import { defineConfig, env } from 'prisma/config'

// Load .env.local for Prisma CLI (Next.js doesn't auto-load it for CLI tools)
config({ path: path.resolve(process.cwd(), '.env.local') })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
