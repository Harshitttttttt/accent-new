import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn utility (clsx + tailwind-merge)', () => {
  it('combines class names cleanly', () => {
    expect(cn('btn', 'btn-primary')).toBe('btn btn-primary')
  })

  it('resolves conflicting Tailwind utility classes', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('handles conditional class expressions and falsy values', () => {
    const isPrimary = true
    const isDisabled = false
    expect(cn('base', isPrimary && 'active', isDisabled && 'disabled', null, undefined)).toBe(
      'base active',
    )
  })
})
