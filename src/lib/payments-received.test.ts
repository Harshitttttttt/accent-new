import { describe, expect, it } from 'vitest'
import {
  CLIENT_PAYMENT_STATUS_BADGES,
  CLIENT_PAYMENT_STATUS_LABELS,
  computePaymentReceivedNet,
  computePaymentsReceivedStats,
  paymentReceivedInputSchema,
  type PaymentReceivedListItem,
} from './payments-received'

describe('payments-received domain logic', () => {
  it('calculates net received amount correctly with Decimal.js', () => {
    // 100,000 INR (10,000,000 paise) - 2% TDS (200,000 paise) - 50 INR Bank charges (5,000 paise)
    const net = computePaymentReceivedNet(10_000_000, 200_000, 5_000)
    expect(net).toBe(9_795_000) // 97,950 INR
  })

  it('clamps net received amount to 0 if deductions exceed gross', () => {
    const net = computePaymentReceivedNet(10_000, 20_000, 5_000)
    expect(net).toBe(0)
  })

  it('computes summary statistics across payments', () => {
    const mockItems: PaymentReceivedListItem[] = [
      {
        id: '1',
        receiptNumber: 'REC-001-08-2026',
        companyId: null,
        companyName: 'Acme Corp',
        projectId: null,
        projectName: null,
        invoiceId: null,
        invoiceNumber: 'SI-001-08-2026',
        clientPoId: null,
        clientPoNumber: null,
        bankId: null,
        bankName: 'HDFC Bank',
        bankAccountNumber: '123456789',
        paymentDate: '2026-08-25',
        paymentType: 'invoice_payment',
        paymentMode: 'neft',
        transactionReference: 'UTR123456',
        chequeDate: null,
        chequeBank: null,
        amountPaise: 5_000_000,
        tdsDeductedPaise: 100_000,
        bankChargesPaise: 0,
        netAmountPaise: 4_900_000,
        status: 'cleared',
        receiptUrl: null,
        notes: null,
        createdAt: '2026-08-25T10:00:00Z',
        updatedAt: '2026-08-25T10:00:00Z',
      },
      {
        id: '2',
        receiptNumber: 'REC-002-08-2026',
        companyId: null,
        companyName: 'Beta Industries',
        projectId: null,
        projectName: null,
        invoiceId: null,
        invoiceNumber: null,
        clientPoId: null,
        clientPoNumber: null,
        bankId: null,
        bankName: 'ICICI Bank',
        bankAccountNumber: '987654321',
        paymentDate: '2026-08-28',
        paymentType: 'advance_payment',
        paymentMode: 'cheque',
        transactionReference: 'CHQ998877',
        chequeDate: '2026-08-28',
        chequeBank: 'State Bank of India',
        amountPaise: 2_000_000,
        tdsDeductedPaise: 0,
        bankChargesPaise: 0,
        netAmountPaise: 2_000_000,
        status: 'pending_clearance',
        receiptUrl: null,
        notes: null,
        createdAt: '2026-08-28T12:00:00Z',
        updatedAt: '2026-08-28T12:00:00Z',
      },
    ]

    const stats = computePaymentsReceivedStats(mockItems)
    expect(stats.totalCount).toBe(2)
    expect(stats.clearedCount).toBe(1)
    expect(stats.pendingCount).toBe(1)
    expect(stats.totalReceivedPaise).toBe(7_000_000)
    expect(stats.clearedPaise).toBe(5_000_000)
    expect(stats.pendingPaise).toBe(2_000_000)
    expect(stats.totalTdsPaise).toBe(100_000)
    expect(stats.netDepositedPaise).toBe(4_900_000)
  })

  it('validates payment input schema', () => {
    const valid = paymentReceivedInputSchema.safeParse({
      companyName: 'Acme Corp',
      paymentDate: '2026-08-29',
      paymentType: 'invoice_payment',
      paymentMode: 'neft',
      amountPaise: 1_000_000,
      tdsDeductedPaise: 20_000,
      bankChargesPaise: 0,
      status: 'cleared',
    })
    expect(valid.success).toBe(true)

    const invalid = paymentReceivedInputSchema.safeParse({
      companyName: '',
      paymentDate: 'not-a-date',
      amountPaise: 0, // must be positive
    })
    expect(invalid.success).toBe(false)
  })

  it('maps all status codes to human readable labels and badges', () => {
    expect(CLIENT_PAYMENT_STATUS_LABELS.cleared).toBe('Cleared / Credited')
    expect(CLIENT_PAYMENT_STATUS_BADGES.cleared).toBe('badge-success')
    expect(CLIENT_PAYMENT_STATUS_BADGES.pending_clearance).toBe('badge-warning')
    expect(CLIENT_PAYMENT_STATUS_BADGES.bounced).toBe('badge-danger')
  })
})
