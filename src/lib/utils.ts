/**
 * Capitalize the first letter of a string.
 * Returns the original string if empty or not a string.
 */
export function capitalizeFirst(str: string | null | undefined): string {
  if (!str) return str ?? "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
