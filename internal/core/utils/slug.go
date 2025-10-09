package utils

import (
	"backthynk/internal/config"
	"regexp"
	"strings"
	"unicode"
)

// GenerateSlug converts a display name into a URL-safe slug
// Example: "My Project - 2024" -> "my-project-2024"
func GenerateSlug(name string) string {
	// Convert to lowercase
	slug := strings.ToLower(name)

	// Replace accented characters with ASCII equivalents (basic version)
	slug = removeAccents(slug)

	// Remove apostrophes entirely (they don't need to become hyphens)
	slug = strings.ReplaceAll(slug, "'", "")

	// Replace spaces and special characters with hyphens
	// Keep only alphanumeric and hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")

	// Remove leading/trailing hyphens
	slug = strings.Trim(slug, "-")

	// Replace multiple consecutive hyphens with single hyphen
	multiHyphen := regexp.MustCompile(`-+`)
	slug = multiHyphen.ReplaceAllString(slug, "-")

	return slug
}

// ValidateDisplayName checks if the display name meets requirements
// Allows: letters, numbers, spaces, hyphens, underscores, apostrophes, periods
// BUT: Only letters and numbers can appear consecutively - all special chars must be separated
func ValidateDisplayName(name string) bool {
	if len(name) == 0 {
		return false
	}

	// First check: only allowed characters (letters, numbers, spaces, hyphens, underscores, apostrophes, periods)
	basicPattern := regexp.MustCompile(config.SpaceNamePattern)
	if !basicPattern.MatchString(name) {
		return false
	}

	// Second check: no consecutive special characters
	// This regex matches any two consecutive special chars (non-alphanumeric)
	consecutiveSpecialChars := regexp.MustCompile(`[\s\-_'.]{2,}`)
	return !consecutiveSpecialChars.MatchString(name)
}

// removeAccents removes common accented characters
func removeAccents(s string) string {
	// This is a simple version - for production you might want a more comprehensive mapping
	var result strings.Builder
	for _, r := range s {
		// Convert common accented characters to their ASCII equivalents
		switch r {
		case 'à', 'á', 'â', 'ã', 'ä', 'å':
			result.WriteRune('a')
		case 'è', 'é', 'ê', 'ë':
			result.WriteRune('e')
		case 'ì', 'í', 'î', 'ï':
			result.WriteRune('i')
		case 'ò', 'ó', 'ô', 'õ', 'ö':
			result.WriteRune('o')
		case 'ù', 'ú', 'û', 'ü':
			result.WriteRune('u')
		case 'ý', 'ÿ':
			result.WriteRune('y')
		case 'ñ':
			result.WriteRune('n')
		case 'ç':
			result.WriteRune('c')
		default:
			// If it's a regular ASCII character, keep it
			if r <= unicode.MaxASCII {
				result.WriteRune(r)
			}
			// Otherwise, skip it (non-ASCII characters we don't handle)
		}
	}
	return result.String()
}
