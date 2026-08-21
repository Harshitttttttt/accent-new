import { neon } from '@neondatabase/serverless'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '../env/server'

type NeonClient = ReturnType<typeof neon>
type DrizzleClient = ReturnType<typeof drizzle>

let cachedClient: NeonClient | null = null
let cachedDb: DrizzleClient | null = null

function getClient(): NeonClient {
  if (cachedClient) return cachedClient
  const url = env.DEV_DB_URL
  cachedClient = neon(url)
  return cachedClient
}

function getDb(): DrizzleClient {
  if (cachedDb) return cachedDb
  cachedDb = drizzle({ client: getClient() })
  return cachedDb
}

// Proxy preserves `import { db }` shape while deferring `neon()` until first
// query. Required on Workers where `DEV_DB_URL` is injected at runtime via
// `process.env` (`nodejs_compat` shim) and may be absent during `vite build`.
export const db: DrizzleClient = new Proxy({} as DrizzleClient, {
  get(_target, prop) {
    const instance = getDb()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(instance) : value
  },
})

export async function pingDatabase(): Promise<void> {
  await getDb().execute(sql`select 1`)
}
