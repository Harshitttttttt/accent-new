// @deprecated — use '~/lib/client-quotations.functions' instead.
export * from './client-quotations.functions'
import { getClientQuotationsPageData, getClientQuotationDocumentData } from './client-quotations.functions'
// Legacy aliases
export const getQuotationsPageData = getClientQuotationsPageData
export const getQuotationDocumentData = getClientQuotationDocumentData
