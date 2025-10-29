/**
 * Generate slug from a display name - matches the backend implementation
 * Example: "My Project - 2024" -> "my-project-2024"
 */
export function generateSlug(name: string): string {
  // Convert to lowercase
  let slug = name.toLowerCase();

  // Remove accents
  slug = removeAccents(slug);

  // Remove apostrophes entirely
  slug = slug.replace(/'/g, '');

  // Replace spaces and special characters with hyphens
  // Keep only alphanumeric and hyphens
  slug = slug.replace(/[^a-z0-9]+/g, '-');

  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Replace multiple consecutive hyphens with single hyphen
  slug = slug.replace(/-+/g, '-');

  return slug;
}

/**
 * Remove common accented characters
 */
function removeAccents(s: string): string {
  const accentMap: { [key: string]: string } = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ñ': 'n',
    'ç': 'c'
  };

  let result = '';
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    const mapped = accentMap[char];
    if (mapped) {
      result += mapped;
    } else if (char.charCodeAt(0) <= 127) {
      // Keep ASCII characters
      result += char;
    }
    // Skip non-ASCII characters we don't handle
  }

  return result;
}
