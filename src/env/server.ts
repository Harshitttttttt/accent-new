import 'dotenv/config'
import * as z from 'zod'

// Workers-compatible: `vite build` must not fail when `DEV_DB_URL` is only
// available at runtime via `wrangler` `vars`/`secrets` (exposed as
// `process.env` with `nodejs_compat`). Validate lazily on first `env` access so
// builds on CI succeed, but runtime still throws clearly if misconfigured.

const EnvSchema = z.object({
  DEV_DB_URL: z.url(),
  DEV_PORT: z.coerce.number().int().min(1024).max(65535).optional(),
})

function getRawEnvValue(key: 'DEV_DB_URL' | 'DEV_PORT'): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env[key] : undefined
  if (fromProcess) return fromProcess
  // workerd `process.env` shimfallback
  const g = globalThis as unknown as Record<string, unknown>
  const maybeProcess = g.process as { env?: Record<string, string | undefined> } | undefined
  return maybeProcess?.env?.[key]
}

export const env: { DEV_DB_URL: string; DEV_PORT: number } = new Proxy(
  {} as { DEV_DB_URL: string; DEV_PORT: number },
  {
    get(_target, prop) {
      if (prop === 'DEV_DB_URL') {
        const raw = getRawEnvValue('DEV_DB_URL')
        if (!raw) {
          throw new Error(
            'DEV_DB_URL is not set. Local: add it to `.dev.vars` (Workers `vite dev`) or `.env` (Node). Production: `wrangler secret put DEV_DB_URL` or set `vars.DEV_DB_URL` in `wrangler.jsonc` / Cloudflare dashboard.',
          )
        }
        return EnvSchema.shape.DEV_DB_URL.parse(raw)
      }
      if (prop === 'DEV_PORT') {
        const raw = getRawEnvValue('DEV_PORT')
        if (raw === undefined) return 3000
        return EnvSchema.shape.DEV_PORT.parse(raw)
      }
      return undefined as unknown as string
    },
  },
)
