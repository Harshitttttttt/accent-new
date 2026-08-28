import { calculateTax, toDecimal } from './money'
import {
  OPEN_PROPOSAL_STATUSES,
  PROPOSAL_STATUS_BADGES,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUSES,
  quotationLinesTotalPaise,
  type ProposalDetail,
  type ProposalStatus,
} from './proposals'

// ── Vocabulary ────────────────────────────────────────────────────────────
/**
 * A quotation IS a proposal in its commercial role — one document, one
 * status vocabulary. The old CRM kept three parallel MySQL tables with a
 * separate draft/sent/approved/rejected enum; here the unified proposal
 * pipeline is the single source of truth.
 */
export type ClientQuotationStatus = ProposalStatus

export const CLIENT_QUOTATION_STATUSES = PROPOSAL_STATUSES
export const CLIENT_QUOTATION_STATUS_LABELS = PROPOSAL_STATUS_LABELS
export const CLIENT_QUOTATION_STATUS_BADGES = PROPOSAL_STATUS_BADGES

/** GST rate printed on quotations — statutory default per the standard terms. */
export const CLIENT_QUOTATION_GST_RATE_PCT = 18

// ── Serialized shapes crossing the RPC boundary ──────────────────────────
export type ClientQuotationListItem = {
  id: string
  proposalNumber: string
  title: string
  companyName: string
  status: ClientQuotationStatus
  valuePaise: number | null
  createdAt: string
}

export type ClientQuotationsPagePayload = {
  authorized: boolean
  quotations: ClientQuotationListItem[]
}

/** The print document reuses the full proposal detail payload as-is. */
export type ClientQuotationDocumentPayload = {
  authorized: boolean
  quotation: ProposalDetail | null
}

// ── Stats rollup (mirrors computeProposalStats) ───────────────────────────
export type ClientQuotationStats = {
  totalCount: number
  draftCount: number
  sentCount: number
  acceptedCount: number
  rejectedCount: number
  /** Pipeline value still live (draft/review/sent/negotiation). */
  openValuePaise: number
  acceptedValuePaise: number
}

export function computeClientQuotationStats(
  quotations: readonly {
    status: ClientQuotationStatus
    valuePaise: number | null
  }[],
): ClientQuotationStats {
  let totalCount = 0
  let draftCount = 0
  let sentCount = 0
  let acceptedCount = 0
  let rejectedCount = 0
  let openValuePaise = 0
  let acceptedValuePaise = 0

  for (const quotation of quotations) {
    totalCount += 1
    const valuePaise = quotation.valuePaise ?? 0
    switch (quotation.status) {
      case 'draft':
        draftCount += 1
        break
      case 'sent':
        sentCount += 1
        break
      case 'accepted':
        acceptedCount += 1
        break
      case 'rejected':
        rejectedCount += 1
        break
    }
    if (OPEN_PROPOSAL_STATUSES.includes(quotation.status)) openValuePaise += valuePaise
    if (quotation.status === 'accepted') acceptedValuePaise += valuePaise
  }

  return { totalCount, draftCount, sentCount, acceptedCount, rejectedCount, openValuePaise, acceptedValuePaise }
}

// ── Document totals ───────────────────────────────────────────────────────
export type ClientQuotationTotals = {
  subtotalPaise: number
  gstPaise: number
  totalPaise: number
}

/**
 * Printed totals for a quotation. Line amounts win over the manually entered
 * value (same precedence as `updateProposal`); GST applies at the statutory
 * default and rounds HALF_UP into whole paise exactly once, at the end.
 */
export function computeClientQuotationTotals(input: {
  lines: readonly { quantity: number; unitPricePaise: number }[]
  valuePaise: number | null
}): ClientQuotationTotals {
  const subtotalPaise =
    input.lines.length > 0 ? quotationLinesTotalPaise(input.lines) : Math.max(0, input.valuePaise ?? 0)

  // calculateTax works in rupee-space; Decimal keeps the paise→rupee shift exact.
  const subtotalRupees = toDecimal(subtotalPaise).dividedBy(100)
  const tax = calculateTax(subtotalRupees, CLIENT_QUOTATION_GST_RATE_PCT)

  return {
    subtotalPaise,
    gstPaise: tax.taxPaise,
    totalPaise: tax.taxablePaise + tax.taxPaise,
  }
}

// ── Rich-text → plain text ────────────────────────────────────────────────
const BLOCK_CLOSING_TAGS = /<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi
const LINE_BREAK_TAGS = /<br\s*\/?>/gi

/**
 * Flatten rich-editor HTML (scope of work) into readable plain text for the
 * printed document. Block elements become newlines, list items become
 * bullets, and only the entities editors actually emit are decoded. Raw HTML
 * is intentionally never rendered into the DOM.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  const text = html
    .replace(LINE_BREAK_TAGS, '\n')
    .replace(BLOCK_CLOSING_TAGS, '\n')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
  // Collapse runs of blank lines left by nested block closings.
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line !== '' || (index > 0 && lines[index - 1] !== ''))
    .join('\n')
    .trim()
}

// ── Legacy aliases (for old imports) ────────────────────────────────────
/** @deprecated use ClientQuotationStatus */
export type QuotationStatus = ClientQuotationStatus
/** @deprecated use CLIENT_QUOTATION_STATUSES */
export const QUOTATION_STATUSES = CLIENT_QUOTATION_STATUSES
/** @deprecated use CLIENT_QUOTATION_STATUS_LABELS */
export const QUOTATION_STATUS_LABELS = CLIENT_QUOTATION_STATUS_LABELS
/** @deprecated use CLIENT_QUOTATION_STATUS_BADGES */
export const QUOTATION_STATUS_BADGES = CLIENT_QUOTATION_STATUS_BADGES
/** @deprecated use ClientQuotationsPagePayload */
export type QuotationsPagePayload = ClientQuotationsPagePayload
/** @deprecated use ClientQuotationListItem */
export type QuotationListItem = ClientQuotationListItem
/** @deprecated use ClientQuotationDocumentPayload */
export type QuotationDocumentPayload = ClientQuotationDocumentPayload
/** @deprecated use computeClientQuotationStats */
export const computeQuotationStats = computeClientQuotationStats
/** @deprecated use computeClientQuotationTotals */
export const computeQuotationTotals = computeClientQuotationTotals
