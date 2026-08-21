import { describe, expect, it } from 'vitest'
import {
  Decimal,
  addMoney,
  calculateMargin,
  calculateTax,
  divideMoney,
  formatINR,
  formatINRCompact,
  formatPaise,
  multiplyMoney,
  paiseToRupees,
  paiseToRupeesNumber,
  parseINRToPaise,
  rupeesToPaise,
  subtractMoney,
  sumMoney,
  toDecimal,
} from './money'

describe('money.ts - Decimal.js & Paise monetary operations', () => {
  describe('toDecimal and conversion utilities', () => {
    it('converts numbers, strings, and bigints to Decimal with high precision', () => {
      expect(toDecimal(10.5).toFixed(2)).toBe('10.50')
      expect(toDecimal('123456.789').toFixed(2)).toBe('123456.79')
      expect(toDecimal(100n).toNumber()).toBe(100)
    })

    it('accurately converts Rupees to Paise integer', () => {
      expect(rupeesToPaise(100)).toBe(10000)
      expect(rupeesToPaise('123.45')).toBe(12345)
      expect(rupeesToPaise(0.1 + 0.2)).toBe(30) // Avoids classic JS float bug: 0.1 + 0.2 = 0.30000000000000004
      expect(rupeesToPaise('100000.50')).toBe(10000050)
    })

    it('accurately converts Paise integer to Rupees Decimal', () => {
      expect(paiseToRupees(10000).toString()).toBe('100')
      expect(paiseToRupees(12345).toString()).toBe('123.45')
      expect(paiseToRupeesNumber(50000)).toBe(500)
    })
  })

  describe('exact monetary arithmetic', () => {
    it('performs addition without floating point error', () => {
      const sum = addMoney('0.1', '0.2')
      expect(sum.toString()).toBe('0.3')
    })

    it('performs subtraction, multiplication, and division', () => {
      expect(subtractMoney('100.50', '25.25').toString()).toBe('75.25')
      expect(multiplyMoney('50.00', '1.18').toString()).toBe('59')
      expect(divideMoney('100', '4').toString()).toBe('25')
    })

    it('sums an array of monetary items', () => {
      expect(sumMoney(['100.25', '200.50', '300.25']).toString()).toBe('601')
    })

    it('throws RangeError when dividing by zero', () => {
      expect(() => divideMoney('100', '0')).toThrow('Cannot divide money by zero.')
    })
  })

  describe('tax and margin calculations', () => {
    it('calculates GST / tax breakdown and paise values', () => {
      const result = calculateTax('10000', '18') // 18% GST on ₹ 10,000
      expect(result.taxableAmount.toString()).toBe('10000')
      expect(result.taxAmount.toString()).toBe('1800')
      expect(result.totalWithTax.toString()).toBe('11800')
      expect(result.taxablePaise).toBe(1000000)
      expect(result.taxPaise).toBe(180000)
      expect(result.totalWithTaxPaise).toBe(1180000)
    })

    it('calculates profit margin percentages', () => {
      const result = calculateMargin('100000', '70000')
      expect(result.grossProfit.toString()).toBe('30000')
      expect(result.marginPercentage.toString()).toBe('30')
      expect(result.grossProfitPaise).toBe(3000000)
    })
  })

  describe('Indian Rupee (INR) formatting standards', () => {
    it('formats numbers using Indian grouping (Lakhs and Crores)', () => {
      expect(formatINR('123456.78')).toBe('₹ 1,23,456.78')
      expect(formatINR('10000000')).toBe('₹ 1,00,00,000.00')
      expect(formatINR('5000')).toBe('₹ 5,000.00')
      expect(formatINR('450', { decimals: 0 })).toBe('₹ 450')
      expect(formatINR('125000', { showSymbol: false })).toBe('1,25,000.00')
    })

    it('formats paise directly using formatPaise', () => {
      expect(formatPaise(12345678)).toBe('₹ 1,23,456.78')
      expect(formatPaise(100000)).toBe('₹ 1,000.00')
    })

    it('formats compact representations for dashboards and cards', () => {
      expect(formatINRCompact('42000000')).toBe('₹ 4.20 Cr')
      expect(formatINRCompact('8500000')).toBe('₹ 85.00 L')
      expect(formatINRCompact('350000')).toBe('₹ 3.50 L')
      expect(formatINRCompact('25000')).toBe('₹ 25 K')
      expect(formatINRCompact('750')).toBe('₹ 750')
    })

    it('parses formatted INR strings back to Paise integer', () => {
      expect(parseINRToPaise('₹ 1,23,456.78')).toBe(12345678)
      expect(parseINRToPaise('10,00,000')).toBe(100000000)
      expect(parseINRToPaise('')).toBe(0)
    })
  })
})
