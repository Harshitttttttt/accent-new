/**
 * Shared view model for the signed-in user rendered in the CRM chrome
 * (Sidebar / TopBar). Mapped from `getCurrentUser()` at the shell level so
 * components stay decoupled from the server-function boundary.
 */
export interface CrmUserView {
  fullName: string
  username: string
  roleNames: string[]
}

/** "Sara Mohammed" -> "SM"; single-word names use their first letter. */
export function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** Primary (first) role name to display under the user's name. */
export function primaryRoleName(
  user: Pick<CrmUserView, 'roleNames'> | null | undefined,
): string | null {
  return user?.roleNames[0] ?? null
}
