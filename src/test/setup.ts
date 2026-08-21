import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

vi.mock('~/env/server', () => ({
  env: {
    DEV_DB_URL: 'postgresql://postgres:postgres@localhost:5432/test',
  },
}))

vi.mock('~/db/index.server', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
  pingDatabase: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  cleanup()
})
