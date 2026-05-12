/** Persisted role keys from GraphQL / Auth.js → UI copy. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  site_manager: 'Site Manager',
  site_viewer: 'Site Viewer',
};

/** Friendly label for a user role key; unknown keys become Title Case words. */
export function roleDisplayName(role: string | null | undefined): string {
  if (role == null || role === '') return '—';
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
