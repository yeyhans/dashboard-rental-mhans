export interface AdminIdentity {
  name?: string | null;
  email?: string | null;
}

function initialsFromWords(source: string): string {
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0].slice(0, 2).toUpperCase();
}

/**
 * Sidebar avatar initials (D-13, following the S1 "HS" hardcode finding). Prefers the admin's
 * name; falls back to the local part of the email (split on `.`/`_` when it looks like
 * "first.last"); falls back to "?" when there is nothing usable.
 */
export function getAdminInitials(
  admin: AdminIdentity | null | undefined,
): string {
  const name = admin?.name?.trim();
  if (name) {
    return initialsFromWords(name);
  }

  const email = admin?.email?.trim();
  if (!email) return "?";

  const localPart = email.split("@")[0];
  if (!localPart) return "?";

  const withSeparators = localPart.replace(/[._]+/g, " ").trim();
  if (!withSeparators) return "?";

  return initialsFromWords(withSeparators);
}
