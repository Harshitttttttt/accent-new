import { sql } from 'drizzle-orm'
import { db, pingDatabase } from '../src/db/index.server'

try {
  await pingDatabase()
  console.log('Neon database connection OK')

  const tables = await db.execute<{ table_name: string }>(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name;
  `)

  const tableNames = tables.rows.map((row) => String(row.table_name))
  console.log('Existing public tables:', tableNames.join(', ') || 'none')

  const userCount = await db.execute<{ count: string }>(sql`select count(*) as count from users;`)
  console.log('User count:', userCount.rows[0]?.count ?? '0')

  const roles = await db.execute<{ code: string; name: string }>(sql`select code, name from roles order by code;`)
  console.log('Roles in DB:', roles.rows)
} catch (error) {
  console.error('Neon database check failed')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
