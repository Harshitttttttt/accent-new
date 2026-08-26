import { describe, expect, it } from 'vitest'
import { initialsFromName, primaryRoleName } from './user-display'

describe('initialsFromName', () => {
  it('uses the first letters of the first two words', () => {
    expect(initialsFromName('Sara Mohammed')).toBe('SM')
    expect(initialsFromName('harshit ramesh mestry')).toBe('HR')
  })

  it('uses the single letter for one-word names', () => {
    expect(initialsFromName('Chaitanya')).toBe('C')
  })

  it('trims surrounding whitespace', () => {
    expect(initialsFromName('  Ada Lovelace  ')).toBe('AL')
  })

  it('returns an em dash when the name is empty', () => {
    expect(initialsFromName('')).toBe('—')
    expect(initialsFromName('   ')).toBe('—')
  })
})

describe('primaryRoleName', () => {
  it('returns the first role name', () => {
    expect(primaryRoleName({ roleNames: ['Administrator', 'Engineer'] })).toBe('Administrator')
  })

  it('returns null when there are no roles or no user', () => {
    expect(primaryRoleName({ roleNames: [] })).toBeNull()
    expect(primaryRoleName(null)).toBeNull()
  })
})
