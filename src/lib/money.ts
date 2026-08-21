import Decimal from 'decimal.js'

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
})

export { Decimal }

export type MoneyInput = number | string | Decimal | bigint
export type Paise = number

export const PAISE_PER_RUPEE = 100

export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) {
    return value
  }
  if (typeof value === 'bigint') {
    return new Decimal(value.toString())
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError(`Invalid non-finite monetary value: ${value}`)
  }
  try {
    return new Decimal(value)
  } catch (error) {
    throw new TypeError(
      `Failed to parse monetary value "${value}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function rupeesToPaise(rupees: MoneyInput): Paise {
  const dec = toDecimal(rupees)
  return dec.times(PAISE_PER_RUPEE).round().toNumber()
}

export function paiseToRupees(paise: MoneyInput): Decimal {
  const dec = toDecimal(paise)
  return dec.dividedBy(PAISE_PER_RUPEE)
}

export function paiseToRupeesNumber(paise: MoneyInput): number {
  return paiseToRupees(paise).toNumber()
}

export function addMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).plus(toDecimal(b))
}

export function subtractMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).minus(toDecimal(b))
}

export function multiplyMoney(amount: MoneyInput, factor: MoneyInput): Decimal {
  return toDecimal(amount).times(toDecimal(factor))
}

export function divideMoney(amount: MoneyInput, divisor: MoneyInput): Decimal {
  const div = toDecimal(divisor)
  if (div.isZero()) {
    throw new RangeError('Cannot divide money by zero.')
  }
  return toDecimal(amount).dividedBy(div)
}

export function sumMoney(amounts: MoneyInput[]): Decimal {
  return amounts.reduce<Decimal>((acc, cur) => acc.plus(toDecimal(cur)), new Decimal(0))
}

export function calculatePercentage(
  baseAmount: MoneyInput,
  percentage: MoneyInput,
): Decimal {
  return toDecimal(baseAmount).times(toDecimal(percentage)).dividedBy(100)
}

export function calculateTax(
  amount: MoneyInput,
  taxRatePercentage: MoneyInput,
): {
  taxableAmount: Decimal
  taxAmount: Decimal
  totalWithTax: Decimal
  taxablePaise: Paise
  taxPaise: Paise
  totalWithTaxPaise: Paise
} {
  const taxableAmount = toDecimal(amount)
  const taxAmount = calculatePercentage(taxableAmount, taxRatePercentage)
  const totalWithTax = taxableAmount.plus(taxAmount)

  return {
    taxableAmount,
    taxAmount,
    totalWithTax,
    taxablePaise: rupeesToPaise(taxableAmount),
    taxPaise: rupeesToPaise(taxAmount),
    totalWithTaxPaise: rupeesToPaise(totalWithTax),
  }
}

export function calculateMargin(
  revenue: MoneyInput,
  cost: MoneyInput,
): {
  grossProfit: Decimal
  marginPercentage: Decimal
  grossProfitPaise: Paise
} {
  const rev = toDecimal(revenue)
  const cst = toDecimal(cost)
  const grossProfit = rev.minus(cst)
  const marginPercentage = rev.isZero()
    ? new Decimal(0)
    : grossProfit.dividedBy(rev).times(100)

  return {
    grossProfit,
    marginPercentage,
    grossProfitPaise: rupeesToPaise(grossProfit),
  }
}

export interface FormatINROptions {
  showSymbol?: boolean
  decimals?: number
  fromPaise?: boolean
}

export function formatINR(
  amount: MoneyInput,
  options: FormatINROptions = {},
): string {
  const { showSymbol = true, decimals = 2, fromPaise = false } = options
  const dec = fromPaise ? paiseToRupees(amount) : toDecimal(amount)
  const isNegative = dec.isNegative()
  const absoluteDec = dec.abs()

  const rounded = absoluteDec.toFixed(decimals)
  const [integerPart = '0', decimalPart] = rounded.split('.')

  let formattedInteger = ''
  if (integerPart.length <= 3) {
    formattedInteger = integerPart
  } else {
    const lastThree = integerPart.slice(-3)
    const remaining = integerPart.slice(0, -3)
    const formattedRemaining = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    formattedInteger = `${formattedRemaining},${lastThree}`
  }

  const valueString =
    decimalPart !== undefined && decimals > 0
      ? `${formattedInteger}.${decimalPart}`
      : formattedInteger

  const symbolPrefix = showSymbol ? '₹ ' : ''
  const sign = isNegative ? '-' : ''

  return `${sign}${symbolPrefix}${valueString}`
}

export function formatPaise(
  paise: MoneyInput,
  options: Omit<FormatINROptions, 'fromPaise'> = {},
): string {
  return formatINR(paise, { ...options, fromPaise: true })
}

export function formatINRCompact(
  amount: MoneyInput,
  options: { showSymbol?: boolean; fromPaise?: boolean } = {},
): string {
  const { showSymbol = true, fromPaise = false } = options
  const dec = fromPaise ? paiseToRupees(amount) : toDecimal(amount)
  const isNegative = dec.isNegative()
  const abs = dec.abs()
  const symbol = showSymbol ? '₹ ' : ''
  const sign = isNegative ? '-' : ''

  const oneCrore = new Decimal(10_000_000)
  const oneLakh = new Decimal(100_000)
  const oneThousand = new Decimal(1_000)

  if (abs.greaterThanOrEqualTo(oneCrore)) {
    const val = abs.dividedBy(oneCrore).toFixed(2)
    return `${sign}${symbol}${val} Cr`
  }

  if (abs.greaterThanOrEqualTo(oneLakh)) {
    const val = abs.dividedBy(oneLakh).toFixed(2)
    return `${sign}${symbol}${val} L`
  }

  if (abs.greaterThanOrEqualTo(oneThousand)) {
    const val = abs.dividedBy(oneThousand).toFixed(0)
    return `${sign}${symbol}${val} K`
  }

  return formatINR(dec, { showSymbol, decimals: 0 })
}

export function parseINRToPaise(formattedString: string): Paise {
  const cleaned = formattedString
    .replace(/[₹\s,]/g, '')
    .replace(/[^\d.-]/g, '')

  if (!cleaned || cleaned === '-') {
    return 0
  }

  return rupeesToPaise(cleaned)
}
