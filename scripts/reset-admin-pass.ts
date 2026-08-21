import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { usersTable } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../src/lib/auth.server'
import * as dotenv from 'dotenv'
dotenv.config()
const url = process.env.DEV_DB_URL!
const client = neon(url)
const db = drizzle({ client })
async function main() {
  const pass = 'Admin12345678'
  const hash = await hashPassword(pass)
  console.log('hash', hash.slice(0,20)+'...')
  const updated = await db.update(usersTable).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(usersTable.username, 'accent')).returning()
  console.log('updated accent', updated[0]?.email)
  const updated2 = await db.update(usersTable).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(usersTable.username, 'sara.mohammed')).returning()
  console.log('updated sara', updated2[0]?.email)
  console.log('New password for both: Admin12345678')
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})
