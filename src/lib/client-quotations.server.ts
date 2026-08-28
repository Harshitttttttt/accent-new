import { desc, isNull } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { proposalsTable } from '~/db/schema'
import { findSessionById, parseSessionCookie, userHasPermission } from './auth.server'
import {
  type ClientQuotationDocumentPayload,
  type ClientQuotationListItem,
  type ClientQuotationsPagePayload,
} from './client-quotations'
import { getProposalDetail } from './proposals.server'

/** Upper bound for the single-snapshot page fetch; the list UI filters client-side. */
const MAX_QUOTATIONS = 500

// ── Reads ────────────────────────────────────────────────────────────────
export async function listClientQuotations(): Promise<ClientQuotationListItem[]> {
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

export async function getClientQuotationsPage(): Promise<ClientQuotationsPagePayload> {
  return { authorized: true, quotations: await listClientQuotations() }
}

export async function getClientQuotationDocument(id: string): Promise<ClientQuotationDocumentPayload['quotation']> {
  return getProposalDetail(id)
}

// ── Cookie-bound wrappers (called from server functions) ─────────────────
async function requireReadPermission(cookieHeader: string | undefined): Promise<boolean> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return false
  return userHasPermission(session.user.id, 'proposals.read')
}

export async function getClientQuotationsPageDataForCookie(
  cookieHeader: string | undefined,
): Promise<ClientQuotationsPagePayload> {
  if (!(await requireReadPermission(cookieHeader))) {
    return { authorized: false, quotations: [] }
  }
  return getClientQuotationsPage()
}

export async function getClientQuotationDocumentForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<ClientQuotationDocumentPayload> {
  if (!(await requireReadPermission(cookieHeader))) {
    return { authorized: false, quotation: null }
  }
  const quotation = await getClientQuotationDocument(id)
  return { authorized: true, quotation }
}


// ── Legacy aliases ──
/** @deprecated use listClientQuotations */
export const listQuotations = listClientQuotations
/** @deprecated use getClientQuotationsPage */
export const getQuotationsPage = getClientQuotationsPage
/** @deprecated use getClientQuotationDocument */
export const getQuotationDocument = getClientQuotationDocument
/** @deprecated use getClientQuotationsPageDataForCookie */
export const getQuotationsPageDataForCookie = getClientQuotationsPageDataForCookie
/** @deprecated use getClientQuotationDocumentForCookie */
export const getQuotationDocumentForCookie = getClientQuotationDocumentForCookie

