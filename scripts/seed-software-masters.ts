import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { softwareMastersTable } from '../src/db/schema'
import * as dotenv from 'dotenv'
dotenv.config()
const url = process.env.DEV_DB_URL!
const client = neon(url)
const db = drizzle({ client })

async function main() {
  console.log('Seeding Software Masters...')
  const rows = await db.insert(softwareMastersTable).values([
    { code: 'SW-ACAD-2024', name: 'AutoCAD', vendor: 'Autodesk', version: '2024.1', licenseType: 'Subscription', totalLicenses: 10, usedLicenses: 7, costPaise: 125000 * 100, purchaseDate: '2024-01-15', expiryDate: '2025-01-15', description: '2D/3D CAD drafting' },
    { code: 'SW-REVIT-2024', name: 'Revit', vendor: 'Autodesk', version: '2024', licenseType: 'Subscription', totalLicenses: 5, usedLicenses: 5, costPaise: 250000 * 100, purchaseDate: '2024-02-01', expiryDate: '2024-12-31', description: 'BIM modelling' },
    { code: 'SW-STAAD-2023', name: 'STAAD.Pro', vendor: 'Bentley', version: '2023', licenseType: 'Perpetual', totalLicenses: 8, usedLicenses: 3, costPaise: 300000 * 100, purchaseDate: '2023-06-10', expiryDate: '2026-06-10', description: 'Structural analysis' },
    { code: 'SW-P6-2024', name: 'Primavera P6', vendor: 'Oracle', version: '22.12', licenseType: 'Enterprise', totalLicenses: 15, usedLicenses: 12, costPaise: 500000 * 100, purchaseDate: '2024-03-20', expiryDate: '2025-03-20', description: 'Project scheduling' },
    { code: 'SW-MSPS-2024', name: 'MS Project', vendor: 'Microsoft', version: '2024', licenseType: 'Subscription', totalLicenses: 20, usedLicenses: 15, costPaise: 75000 * 100, purchaseDate: '2024-04-01', expiryDate: '2025-04-01', description: 'Project management' },
    { code: 'SW-NAVIS-2024', name: 'Navisworks Manage', vendor: 'Autodesk', version: '2024', licenseType: 'Network', totalLicenses: 6, usedLicenses: 2, costPaise: 180000 * 100, purchaseDate: '2024-05-10', expiryDate: '2024-11-10', description: '3D coordination' },
  ]).onConflictDoNothing({ target: softwareMastersTable.code }).returning()
  console.log(`Inserted ${rows.length} software masters`)
  const all = await db.select().from(softwareMastersTable)
  console.log(`Total now: ${all.length}`)
  for (const r of all) console.log(`${r.code} ${r.name} ${r.vendor} ${r.totalLicenses} used:${r.usedLicenses} cost:${r.costPaise/100} expiry:${r.expiryDate}`)
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})
