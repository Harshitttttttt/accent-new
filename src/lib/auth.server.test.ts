import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  normalizeIpAddress,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from './auth.server'

describe('auth.server security primitives', () => {
  describe('password hashing & verification (scrypt)', () => {
    it('hashes and successfully verifies a valid password', async () => {
      const password = 'CorrectPassword2026!'
      const hash = await hashPassword(password)

      expect(hash).toContain('scrypt$')
      expect(await verifyPassword(password, hash)).toBe(true)
      expect(await verifyPassword('WrongPassword1234', hash)).toBe(false)
    })

    it('rejects passwords shorter than 12 characters', async () => {
      await expect(hashPassword('short')).rejects.toThrow(
        'Password must be between 12 and 256 characters',
      )
    })

    it('returns false on malformed or corrupted hashes', async () => {
      expect(await verifyPassword('Password123456!', 'not-a-hash')).toBe(false)
      expect(await verifyPassword('Password123456!', 'scrypt$invalid$format')).toBe(false)
    })
  })

  describe('normalizeIpAddress', () => {
    it('extracts first IP from comma-separated x-forwarded-for header', () => {
      expect(normalizeIpAddress('203.0.113.195, 70.41.3.18, 150.172.238.178')).toBe(
        '203.0.113.195',
      )
    })

    it('handles IPv4 and IPv6 addresses', () => {
      expect(normalizeIpAddress('192.168.1.1')).toBe('192.168.1.1')
      expect(normalizeIpAddress('::1')).toBe('::1')
      expect(normalizeIpAddress('[2001:db8::1]')).toBe('2001:db8::1')
    })

    it('returns null for missing or invalid IP strings', () => {
      expect(normalizeIpAddress(undefined)).toBeNull()
      expect(normalizeIpAddress('')).toBeNull()
      expect(normalizeIpAddress('not-an-ip')).toBeNull()
    })
  })

  describe('parseSessionCookie', () => {
    it('extracts session ID from standard cookie header', () => {
      const cookie = `${SESSION_COOKIE_NAME}=sess_abc123456789; other_cookie=xyz`
      expect(parseSessionCookie(cookie)).toBe('sess_abc123456789')
    })

    it('correctly decodes URI encoded cookie values', () => {
      const cookie = `${SESSION_COOKIE_NAME}=sess%2Btest%2F123`
      expect(parseSessionCookie(cookie)).toBe('sess+test/123')
    })

    it('returns null when session cookie is absent', () => {
      expect(parseSessionCookie('theme=dark; lang=en')).toBeNull()
      expect(parseSessionCookie(undefined)).toBeNull()
      expect(parseSessionCookie('')).toBeNull()
    })
  })
})
