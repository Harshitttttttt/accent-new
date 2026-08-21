import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { disciplinesTable, disciplineActivitiesTable, disciplineSubActivitiesTable } from '../src/db/schema'
import { sql } from 'drizzle-orm'
import * as dotenv from 'dotenv'
dotenv.config()

const url = process.env.DEV_DB_URL
if (!url) throw new Error('DEV_DB_URL missing')
const client = neon(url)
const db = drizzle({ client })

async function main() {
  console.log('Seeding Activity Masters...')

  const discs = await db.insert(disciplinesTable).values([
    { code: 'CIVIL', name: 'Civil Engineering', description: 'Civil & Structural works' },
    { code: 'ELEC', name: 'Electrical Engineering', description: 'Electrical and instrumentation' },
    { code: 'MECH', name: 'Mechanical Engineering', description: 'Mechanical piping and HVAC' },
  ]).onConflictDoNothing({ target: disciplinesTable.code }).returning()
  console.log('Disciplines inserted:', discs.length)

  const allDiscs = await db.select().from(disciplinesTable)
  const map = new Map(allDiscs.map(d => [d.code, d.id]))
  console.log('All disciplines:', allDiscs.map(d => `${d.code} ${d.id}`))

  if (allDiscs.length === 0) throw new Error('No disciplines')

  // Activities
  const acts = await db.insert(disciplineActivitiesTable).values([
    { code: 'CIV-STR-01', name: 'Structural Analysis', disciplineId: map.get('CIVIL')!, unit: 'Hours', description: 'Structural calculations and modelling' },
    { code: 'CIV-FND-01', name: 'Foundation Design', disciplineId: map.get('CIVIL')!, unit: 'Nos', description: 'Foundation and footings' },
    { code: 'ELEC-PWR-01', name: 'Power Distribution', disciplineId: map.get('ELEC')!, unit: 'Hours' },
    { code: 'ELEC-LGT-01', name: 'Lighting Design', disciplineId: map.get('ELEC')!, unit: 'SqM' },
    { code: 'MECH-PIP-01', name: 'Piping Layout', disciplineId: map.get('MECH')!, unit: 'M' },
  ]).onConflictDoNothing({ target: disciplineActivitiesTable.code }).returning()
  console.log('Activities inserted:', acts.length)

  const allActs = await db.select().from(disciplineActivitiesTable)
  const actMap = new Map(allActs.map(a => [a.code, a.id]))
  console.log('All activities:', allActs.map(a => `${a.code} ${a.id}`))

  // Sub-activities
  const subs = await db.insert(disciplineSubActivitiesTable).values([
    { code: 'CIV-STR-01-A', name: 'Beam Design', activityId: actMap.get('CIV-STR-01')!, unit: 'Nos' },
    { code: 'CIV-STR-01-B', name: 'Column Design', activityId: actMap.get('CIV-STR-01')!, unit: 'Nos' },
    { code: 'CIV-FND-01-A', name: 'Pile Cap', activityId: actMap.get('CIV-FND-01')!, unit: 'Nos' },
    { code: 'ELEC-PWR-01-A', name: 'Cable Sizing', activityId: actMap.get('ELEC-PWR-01')!, unit: 'Hours' },
    { code: 'MECH-PIP-01-A', name: 'Isometric Drawing', activityId: actMap.get('MECH-PIP-01')!, unit: 'Nos' },
  ]).onConflictDoNothing({ target: disciplineSubActivitiesTable.code }).returning()
  console.log('SubActivities inserted:', subs.length)

  const allSubs = await db.select().from(disciplineSubActivitiesTable)
  console.log('All subs:', allSubs.length)

  // Verify hierarchy via join
  const verify = await db.execute(sql`
    SELECT d.code as disc, a.code as act, s.code as sub
    FROM disciplines d
    JOIN discipline_activities a ON a.discipline_id = d.id
    JOIN discipline_sub_activities s ON s.activity_id = a.id
    ORDER BY d.code, a.code, s.code
  `)
  console.log('Hierarchy rows:', verify.rows.length)
  console.table(verify.rows)

  // Counts
  const discCount = await db.execute(sql`SELECT count(*) FROM disciplines`)
  const actCount = await db.execute(sql`SELECT count(*) FROM discipline_activities`)
  const subCount = await db.execute(sql`SELECT count(*) FROM discipline_sub_activities`)
  console.log('Counts:', discCount.rows, actCount.rows, subCount.rows)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
