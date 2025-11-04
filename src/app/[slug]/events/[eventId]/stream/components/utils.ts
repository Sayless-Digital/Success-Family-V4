/**
 * Stream utility functions
 */

/**
 * Get initials from a name
 * @param name - The name to get initials from
 * @returns The initials (1-2 characters)
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    // Multiple words: first letter of first name + first letter of last name
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  } else if (parts.length === 1 && parts[0].length >= 2) {
    // Single word with 2+ characters: first 2 letters
    return parts[0].substring(0, 2).toUpperCase()
  } else {
    // Single character: just that character
    return parts[0].charAt(0).toUpperCase()
  }
}