import { defineConfig } from 'drizzle-kit'
import { env } from './src/env/server'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DEV_DB_URL,
  },
})
