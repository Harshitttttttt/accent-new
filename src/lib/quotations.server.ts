import { desc, isNull } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { proposalsTable } from '~/db/schema'
import { findSessionById, parseSessionCookie, userHasPermission } from './auth.server'
import {
  type QuotationDocumentPayload,
  type QuotationListItem,
  type QuotationsPagePayload,
} from './quotations'
import { getProposalDetail } from './proposals.server'

/** Upper bound for the single-snapshot page fetch; the list UI filters client-side. */
const MAX_QUOTATIONS = 500

// ── Reads ────────────────────────────────────────────────────────────────
export async function listQuotations(): Promise<QuotationListItem[]> {
  const rows = await db
    .select({
      id: proposalsTable.id,
      proposalNumber: proposalsTable.proposalNumber,
      title: proposalsTable.title,
      companyName: proposalsTable.companyName,
      status: proposalsTable.status,
      valuePaise: proposalsTable.valuePaise,
      createdAt: proposalsTable.createdAt,
    })
    .from(proposalsTable)
    .where(isNull(proposalsTable.deletedAt))
    .orderBy(desc(proposalsTable.createdAt))
    .limit(MAX_QUOTATIONS)

  return rows.map((row) => ({
    id: row.id,
    proposalNumber: row.proposalNumber,
    title: row.title,
    companyName: row.companyName,
    status: row.status,
    valuePaise: row.valuePaise,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function getQuotationsPage(): Promise<QuotationsPagePayload> {
  return { authorized: true, quotations: await listQuotations() }
}

export async function getQuotationDocument(id: string): Promise<QuotationDocumentPayload['quotation']> {
  return getProposalDetail(id)
}

// ── Cookie-bound wrappers (called from server functions) ─────────────────
async function requireReadPermission(cookieHeader: string | undefined): Promise<boolean> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return false
  return userHasPermission(session.user.id, 'proposals.read')
}

export async function getQuotationsPageDataForCookie(
  cookieHeader: string | undefined,
): Promise<QuotationsPagePayload> {
  if (!(await requireReadPermission(cookieHeader))) {
    return { authorized: false, quotations: [] }
  }
  return getQuotationsPage()
}

export async function getQuotationDocumentForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<QuotationDocumentPayload> {
  if (!(await requireReadPermission(cookieHeader))) {
    return { authorized: false, quotation: null }
  }
  const quotation = await getQuotationDocument(id)
  return { authorized: true, quotation }
}
