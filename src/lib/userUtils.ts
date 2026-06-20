import { AppUser } from '../types';

/**
 * Resolves a user ID or email address to a formatted display name.
 */
export const getUserDisplayName = (email: string | null | undefined, allowedUsers: AppUser[] = []): string => {
  if (!email) return '';
  const val = email.trim();

  // Find in allowedUsers
  const matched = allowedUsers.find((u) => u.email.trim().toLowerCase() === val.toLowerCase());
  if (matched && matched.name && matched.name.trim()) {
    return matched.name;
  }

  // Check if purely numeric
  if (/^\d+$/.test(val)) {
    if (val === '8888') return 'Admin 8888';
    return `User ${val}`;
  }

  // Fallback: format prefix of email
  const prefix = val.split('@')[0];
  const formatted = prefix
    .split(/[\._\-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return formatted;
};
