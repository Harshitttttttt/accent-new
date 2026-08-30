import { describe, expect, it } from 'vitest'
import {
  computePaymentReleasedNet,
  computePaymentsReleasedStats,
  paymentReleasedInputSchema,
  PAYMENT_RELEASE_STATUS_BADGES,
  PAYMENT_RELEASE_STATUS_LABELS,
  PAYMENT_RELEASE_TYPE_LABELS,
  type PaymentReleasedListItem,
} from './payments-released'

describe('payments-released domain logic', () => {
  it('calculates net disbursement amount after deductions', () => {
    // Gross 50,000 INR (5,000,000 paise) - Admin adjustment 500 INR (50,000 paise) = 49,500 INR (4,950,000 paise)
    const net = computePaymentReleasedNet(5_000_000, 50_000)
    expect(net).toBe(4_950_000)
  })

  it('clamps net released amount to 0 if deductions exceed gross', () => {
    const net = computePaymentReleasedNet(100_000, 200_000)
    expect(net).toBe(0)
  })

  it('computes summary statistics across released payments', () => {
    const mockItems: PaymentReleasedListItem[] = [
      {
        id: '1',
        paymentNumber: 'REL-001-08-2026',
        companyId: null,
        companyName: 'Acme Corp',
        projectId: null,
        projectName: null,
        saleInvoiceId: null,
        invoiceNumber: null,
        disbursingBankId: null,
        disbursingBankName: 'HDFC Bank',
        clientBankName: 'SBI',
        clientAccountNumber: '9988776655',
        clientIfscCode: 'SBIN0001234',
        releaseDate: '2026-08-25',
        releaseType: 'advance_refund',
        paymentMode: 'neft',
        transactionReference: 'UTR998811',
        amountPaise: 3_000_000,
        deductionPaise: 0,
        netAmountPaise: 3_000_000,
        status: 'cleared',
        reason: 'Cancelled phase 2 advance refund',
        notes: null,
        attachmentUrl: null,
        approvedBy: null,
        approvedAt: null,
        createdAt: '2026-08-25T10:00:00Z',
        updatedAt: '2026-08-25T10:00:00Z',
      },
      {
        id: '2',
        paymentNumber: 'REL-002-08-2026',
        companyId: null,
        companyName: 'Beta Industries',
        projectId: null,
        projectName: null,
        saleInvoiceId: null,
        invoiceNumber: null,
        disbursingBankId: null,
        disbursingBankName: 'ICICI Bank',
        clientBankName: 'Axis Bank',
        clientAccountNumber: '1122334455',
        clientIfscCode: 'UTIB0005678',
        releaseDate: '2026-08-28',
        releaseType: 'security_deposit_refund',
        paymentMode: 'rtgs',
        transactionReference: null,
        amountPaise: 10_000_000,
        deductionPaise: 100_000,
        netAmountPaise: 9_900_000,
        status: 'pending_approval',
        reason: 'Project completion EMD return',
        notes: null,
        attachmentUrl: null,
        approvedBy: null,
        approvedAt: null,
        createdAt: '2026-08-28T12:00:00Z',
        updatedAt: '2026-08-28T12:00:00Z',
      },
    ]

    const stats = computePaymentsReleasedStats(mockItems)
    expect(stats.totalCount).toBe(2)
    expect(stats.clearedCount).toBe(1)
    expect(stats.pendingCount).toBe(1)
    expect(stats.totalReleasedPaise).toBe(13_000_000)
    expect(stats.clearedPaise).toBe(3_000_000)
    expect(stats.pendingApprovalPaise).toBe(10_000_000)
  })

  it('validates payment released input schema', () => {
    const valid = paymentReleasedInputSchema.safeParse({
      companyName: 'Acme Corp',
      releaseDate: '2026-08-29',
      releaseType: 'security_deposit_refund',
      paymentMode: 'neft',
      amountPaise: 5_000_000,
      deductionPaise: 0,
      status: 'pending_approval',
    })
    expect(valid.success).toBe(true)

    const invalid = paymentReleasedInputSchema.safeParse({
      companyName: '',
      releaseDate: 'invalid',
      amountPaise: -50,
    })
    expect(invalid.success).toBe(false)
  })

  it('maps all status codes and release types to labels', () => {
    expect(PAYMENT_RELEASE_STATUS_LABELS.pending_approval).toBe('Pending Approval')
    expect(PAYMENT_RELEASE_STATUS_BADGES.pending_approval).toBe('badge-warning')
    expect(PAYMENT_RELEASE_STATUS_BADGES.cleared).toBe('badge-success')
    expect(PAYMENT_RELEASE_TYPE_LABELS.advance_refund).toBe('Client Advance Refund')
    expect(PAYMENT_RELEASE_TYPE_LABELS.security_deposit_refund).toBe('Security Deposit / EMD Refund')
  })
})
