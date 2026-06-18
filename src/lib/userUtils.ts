import { AppUser } from '../types';

/**
 * Resolves an email address to a formatted display name.
 * If the user has an assigned name in allowedUsers, it uses that.
 * Otherwise, it formats the email prefix to a clean human name.
 */
export const getUserDisplayName = (email: string | null | undefined, allowedUsers: AppUser[] = []): string => {
  if (!email) return '';
  const emailLower = email.trim().toLowerCase();

  // Find in allowedUsers
  const matched = allowedUsers.find((u) => u.email.trim().toLowerCase() === emailLower);
  if (matched && matched.name && matched.name.trim()) {
    return matched.name;
  }

  // Fallback: format prefix of email (e.g. vatsal.patel123@company.com -> Vatsal Patel123)
  const prefix = emailLower.split('@')[0];
  const formatted = prefix
    .split(/[\._\-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return formatted;
};
