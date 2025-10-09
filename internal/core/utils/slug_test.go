package utils

import (
	"regexp"
	"strconv"
	"testing"
)

// ValidateSlug checks if a slug meets URL-safe requirements
// Must contain only lowercase letters, numbers, and hyphens
// Must not start or end with hyphen
func ValidateSlug(slug string) bool {
	if len(slug) == 0 {
		return false
	}

	// Must be lowercase alphanumeric with hyphens only
	// Must not start or end with hyphen
	pattern := regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	return pattern.MatchString(slug)
}

// MakeSlugUnique adds a numeric suffix to make a slug unique
// Example: "my-space" -> "my-space-2" -> "my-space-3"
func MakeSlugUnique(baseSlug string, existingSlugs map[string]bool) string {
	if !existingSlugs[baseSlug] {
		return baseSlug
	}

	counter := 2
	for {
		newSlug := baseSlug + "-" + strconv.Itoa(counter)
		if !existingSlugs[newSlug] {
			return newSlug
		}
		counter++
	}
}

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		// Basic cases
		{
			name:     "Simple name with spaces",
			input:    "My Project",
			expected: "my-project",
		},
		{
			name:     "Name with hyphens",
			input:    "My-Project",
			expected: "my-project",
		},
		{
			name:     "Name with apostrophe",
			input:    "John's Space",
			expected: "johns-space",
		},
		{
			name:     "Name with periods",
			input:    "Version 1.0",
			expected: "version-1-0",
		},
		{
			name:     "Name with underscores",
			input:    "my_project_name",
			expected: "my-project-name",
		},
		{
			name:     "Mixed special characters",
			input:    "My Project - 2024",
			expected: "my-project-2024",
		},

		// Multiple/consecutive characters
		{
			name:     "Multiple spaces",
			input:    "My  Project   Name",
			expected: "my-project-name",
		},
		{
			name:     "Multiple hyphens consolidated",
			input:    "my---project",
			expected: "my-project",
		},
		{
			name:     "Multiple underscores",
			input:    "my___project",
			expected: "my-project",
		},
		{
			name:     "Multiple periods",
			input:    "Version...1.0",
			expected: "version-1-0",
		},
		{
			name:     "Multiple apostrophes",
			input:    "it''s great",
			expected: "its-great",
		},
		{
			name:     "Mix of multiple special chars",
			input:    "my  --__..project",
			expected: "my-project",
		},

		// Whitespace edge cases
		{
			name:     "Leading and trailing spaces",
			input:    "  My Project  ",
			expected: "my-project",
		},
		{
			name:     "Leading hyphens",
			input:    "---My Project",
			expected: "my-project",
		},
		{
			name:     "Trailing hyphens",
			input:    "My Project---",
			expected: "my-project",
		},
		{
			name:     "Leading and trailing mixed",
			input:    "  ---My Project---  ",
			expected: "my-project",
		},
		{
			name:     "Only spaces",
			input:    "     ",
			expected: "",
		},
		{
			name:     "Only hyphens",
			input:    "-----",
			expected: "",
		},
		{
			name:     "Only special characters",
			input:    "!!!@@@###",
			expected: "",
		},

		// Numbers
		{
			name:     "Only numbers",
			input:    "12345",
			expected: "12345",
		},
		{
			name:     "Alphanumeric mix",
			input:    "Project123Test",
			expected: "project123test",
		},
		{
			name:     "Numbers with spaces",
			input:    "1 2 3 4 5",
			expected: "1-2-3-4-5",
		},

		// Special character combinations
		{
			name:     "Mixed special chars removed",
			input:    "Project@#$%Name",
			expected: "project-name",
		},
		{
			name:     "Consecutive different special chars",
			input:    "my-_project",
			expected: "my-project",
		},
		{
			name:     "Special chars between words",
			input:    "My@Project#Name",
			expected: "my-project-name",
		},

		// Accented characters
		{
			name:     "Accented characters",
			input:    "Café René",
			expected: "cafe-rene",
		},
		{
			name:     "Multiple accented characters",
			input:    "àéîôù",
			expected: "aeiou",
		},
		{
			name:     "Mixed accents and special chars",
			input:    "Café - René's Place",
			expected: "cafe-renes-place",
		},

		// Real-world examples
		{
			name:     "Version number",
			input:    "Version 1.0.2",
			expected: "version-1-0-2",
		},
		{
			name:     "Date-like name",
			input:    "2024-01-15",
			expected: "2024-01-15",
		},
		{
			name:     "Possessive with apostrophe",
			input:    "John's 2024 Project",
			expected: "johns-2024-project",
		},
		{
			name:     "French phrase",
			input:    "I'm french",
			expected: "im-french",
		},
		{
			name:     "Title case",
			input:    "A Space",
			expected: "a-space",
		},
		{
			name:     "All caps",
			input:    "NASA PROJECT",
			expected: "nasa-project",
		},
		{
			name:     "Mixed case with numbers",
			input:    "MyProject2024",
			expected: "myproject2024",
		},

		// Very long names
		{
			name:     "Very long name",
			input:    "This is a very long space name that should still be converted properly",
			expected: "this-is-a-very-long-space-name-that-should-still-be-converted-properly",
		},

		// Unicode and emojis
		{
			name:     "Unicode emojis (stripped)",
			input:    "My Project 🚀",
			expected: "my-project",
		},
		{
			name:     "Multiple emojis",
			input:    "🎉 Party 🎊 Time 🎈",
			expected: "party-time",
		},

		// Edge cases with allowed characters
		{
			name:     "Only allowed chars no conversion",
			input:    "abc123",
			expected: "abc123",
		},
		{
			name:     "Single character",
			input:    "A",
			expected: "a",
		},
		{
			name:     "Single number",
			input:    "1",
			expected: "1",
		},
		{
			name:     "Empty string",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateSlug(tt.input)
			if result != tt.expected {
				t.Errorf("GenerateSlug(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestValidateDisplayName(t *testing.T) {
	tests := []struct {
		name  string
		input string
		valid bool
	}{
		// Valid cases - allowed characters
		{
			name:  "Valid simple name",
			input: "My Project",
			valid: true,
		},
		{
			name:  "Valid with hyphen",
			input: "My-Project",
			valid: true,
		},
		{
			name:  "Valid with underscore",
			input: "My_Project",
			valid: true,
		},
		{
			name:  "Valid with apostrophe",
			input: "John's Space",
			valid: true,
		},
		{
			name:  "Valid with period",
			input: "Version 1.0",
			valid: true,
		},
		{
			name:  "Valid numbers only",
			input: "12345",
			valid: true,
		},
		{
			name:  "Valid letters only",
			input: "MyProject",
			valid: true,
		},
		{
			name:  "Valid apostrophes separated by letters",
			input: "it's Tom's",
			valid: true,
		},
		{
			name:  "Valid periods separated by numbers",
			input: "Version 1.0.2",
			valid: true,
		},
		{
			name:  "Valid hyphens separated by letters",
			input: "My-Super-Project",
			valid: true,
		},
		{
			name:  "Valid underscores separated by letters",
			input: "my_project_name",
			valid: true,
		},
		{
			name:  "Valid all allowed characters",
			input: "My-Project_v1.0's",
			valid: true,
		},

		// Valid real-world examples
		{
			name:  "Valid French phrase",
			input: "I'm french",
			valid: true,
		},
		{
			name:  "Valid version number",
			input: "Version 1.0.2",
			valid: true,
		},
		{
			name:  "Valid possessive",
			input: "John's 2024 Project",
			valid: true,
		},
		{
			name:  "Valid mixed case",
			input: "NASA PROJECT",
			valid: true,
		},
		{
			name:  "Valid single character",
			input: "A",
			valid: true,
		},
		{
			name:  "Valid title with spaces",
			input: "A Space",
			valid: true,
		},

		// Invalid cases - forbidden characters
		{
			name:  "Invalid with @ symbol",
			input: "My@Project",
			valid: false,
		},
		{
			name:  "Invalid with # symbol",
			input: "Project#1",
			valid: false,
		},
		{
			name:  "Invalid with $ symbol",
			input: "Project$Name",
			valid: false,
		},
		{
			name:  "Invalid with % symbol",
			input: "100% Project",
			valid: false,
		},
		{
			name:  "Invalid with & symbol",
			input: "You & Me",
			valid: false,
		},
		{
			name:  "Invalid with * symbol",
			input: "Star*Project",
			valid: false,
		},
		{
			name:  "Invalid with parentheses",
			input: "My (Project)",
			valid: false,
		},
		{
			name:  "Invalid with brackets",
			input: "My [Project]",
			valid: false,
		},
		{
			name:  "Invalid with braces",
			input: "My {Project}",
			valid: false,
		},
		{
			name:  "Invalid with forward slash",
			input: "My/Project",
			valid: false,
		},
		{
			name:  "Invalid with backslash",
			input: "My\\Project",
			valid: false,
		},
		{
			name:  "Invalid with pipe",
			input: "My|Project",
			valid: false,
		},
		{
			name:  "Invalid with colon",
			input: "My:Project",
			valid: false,
		},
		{
			name:  "Invalid with semicolon",
			input: "My;Project",
			valid: false,
		},
		{
			name:  "Invalid with quotes",
			input: "My \"Project\"",
			valid: false,
		},
		{
			name:  "Invalid with less than",
			input: "My<Project",
			valid: false,
		},
		{
			name:  "Invalid with greater than",
			input: "My>Project",
			valid: false,
		},
		{
			name:  "Invalid with question mark",
			input: "My?Project",
			valid: false,
		},
		{
			name:  "Invalid with equals",
			input: "My=Project",
			valid: false,
		},
		{
			name:  "Invalid with plus",
			input: "My+Project",
			valid: false,
		},
		{
			name:  "Invalid with tilde",
			input: "My~Project",
			valid: false,
		},
		{
			name:  "Invalid with backtick",
			input: "My`Project",
			valid: false,
		},
		{
			name:  "Invalid with exclamation",
			input: "My!Project",
			valid: false,
		},
		{
			name:  "Invalid with comma",
			input: "My,Project",
			valid: false,
		},

		// Invalid - consecutive special characters
		{
			name:  "Invalid double space",
			input: "My  Project",
			valid: false,
		},
		{
			name:  "Invalid triple space",
			input: "My   Project",
			valid: false,
		},
		{
			name:  "Invalid double hyphen",
			input: "My--Project",
			valid: false,
		},
		{
			name:  "Invalid double underscore",
			input: "My__Project",
			valid: false,
		},
		{
			name:  "Invalid double period",
			input: "Version 1..0",
			valid: false,
		},
		{
			name:  "Invalid double apostrophe",
			input: "it''s",
			valid: false,
		},
		{
			name:  "Invalid space-hyphen",
			input: "My -Project",
			valid: false,
		},
		{
			name:  "Invalid hyphen-space",
			input: "My- Project",
			valid: false,
		},
		{
			name:  "Invalid hyphen-underscore",
			input: "My-_Project",
			valid: false,
		},
		{
			name:  "Invalid underscore-period",
			input: "My_.Project",
			valid: false,
		},
		{
			name:  "Invalid period-apostrophe",
			input: "Version.'1",
			valid: false,
		},
		{
			name:  "Invalid multiple mixed special chars",
			input: "My  --__..Project",
			valid: false,
		},
		{
			name:  "Invalid leading double space",
			input: "  My Project",
			valid: false,
		},
		{
			name:  "Invalid trailing double space",
			input: "My Project  ",
			valid: false,
		},

		// Edge cases
		{
			name:  "Empty string",
			input: "",
			valid: false,
		},
		{
			name:  "Only single space",
			input: " ",
			valid: true, // Single space is allowed
		},
		{
			name:  "Only spaces (multiple)",
			input: "   ",
			valid: false, // Multiple consecutive spaces not allowed
		},
		{
			name:  "Only hyphens",
			input: "---",
			valid: false, // Multiple consecutive hyphens not allowed
		},
		{
			name:  "Single hyphen",
			input: "-",
			valid: true, // Single special char is allowed
		},
		{
			name:  "Emoji (invalid)",
			input: "My Project 🚀",
			valid: false,
		},
		{
			name:  "Mixed valid and invalid",
			input: "My-Project@2024",
			valid: false, // @ makes it invalid
		},
		{
			name:  "Custom Invalid 1",
			input: "I''m french",
			valid: false,
		},
		{
			name:  "Custom Invalid 2",
			input: "I'.m french",
			valid: false,
		},
		{
			name:  "Custom Invalid 3",
			input: "Version 1.0.-2",
			valid: false,
		},
		{
			name:  "Custom Invalid 4",
			input: "Version 100\\%\\%",
			valid: false,
		},
		{
			name:  "Custom Invalid 5",
			input: "Version 100%",
			valid: false,
		},
		{
			name:  "Custom Invalid 6",
			input: "''''''f'''''''f'''",
			valid: false,
		},
		
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateDisplayName(tt.input)
			if result != tt.valid {
				t.Errorf("ValidateDisplayName(%q) = %v, want %v", tt.input, result, tt.valid)
			}
		})
	}
}

func TestValidateSlug(t *testing.T) {
	tests := []struct {
		name  string
		input string
		valid bool
	}{
		{
			name:  "Valid simple slug",
			input: "my-project",
			valid: true,
		},
		{
			name:  "Valid alphanumeric with hyphens",
			input: "project-123-test",
			valid: true,
		},
		{
			name:  "Valid numbers only",
			input: "12345",
			valid: true,
		},
		{
			name:  "Valid letters only",
			input: "myproject",
			valid: true,
		},
		{
			name:  "Invalid with uppercase",
			input: "My-Project",
			valid: false,
		},
		{
			name:  "Invalid with spaces",
			input: "my project",
			valid: false,
		},
		{
			name:  "Invalid with underscore",
			input: "my_project",
			valid: false,
		},
		{
			name:  "Invalid starting with hyphen",
			input: "-myproject",
			valid: false,
		},
		{
			name:  "Invalid ending with hyphen",
			input: "myproject-",
			valid: false,
		},
		{
			name:  "Invalid with double hyphen",
			input: "my--project",
			valid: false,
		},
		{
			name:  "Empty string",
			input: "",
			valid: false,
		},
		{
			name:  "Invalid with special chars",
			input: "my@project",
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateSlug(tt.input)
			if result != tt.valid {
				t.Errorf("ValidateSlug(%q) = %v, want %v", tt.input, result, tt.valid)
			}
		})
	}
}

func TestMakeSlugUnique(t *testing.T) {
	tests := []struct {
		name          string
		baseSlug      string
		existingSlugs map[string]bool
		expected      string
	}{
		{
			name:          "No collision",
			baseSlug:      "my-space",
			existingSlugs: map[string]bool{},
			expected:      "my-space",
		},
		{
			name:     "Single collision",
			baseSlug: "my-space",
			existingSlugs: map[string]bool{
				"my-space": true,
			},
			expected: "my-space-2",
		},
		{
			name:     "Multiple collisions",
			baseSlug: "my-space",
			existingSlugs: map[string]bool{
				"my-space":   true,
				"my-space-2": true,
				"my-space-3": true,
			},
			expected: "my-space-4",
		},
		{
			name:     "Gap in numbering",
			baseSlug: "my-space",
			existingSlugs: map[string]bool{
				"my-space":   true,
				"my-space-3": true,
			},
			expected: "my-space-2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MakeSlugUnique(tt.baseSlug, tt.existingSlugs)
			if result != tt.expected {
				t.Errorf("MakeSlugUnique(%q, ...) = %q, want %q", tt.baseSlug, result, tt.expected)
			}
		})
	}
}

func TestGenerateSlugConsistency(t *testing.T) {
	// Test that the same input always produces the same slug
	input := "My Project - 2024"
	expected := GenerateSlug(input)

	for i := 0; i < 100; i++ {
		result := GenerateSlug(input)
		if result != expected {
			t.Errorf("GenerateSlug is not consistent: first=%q, iteration %d=%q", expected, i, result)
		}
	}
}

func TestGenerateSlugEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Only special characters",
			input:    "!!!@@@###",
			expected: "",
		},
		{
			name:     "Only spaces",
			input:    "     ",
			expected: "",
		},
		{
			name:     "Only hyphens",
			input:    "-----",
			expected: "",
		},
		{
			name:     "Unicode emojis (stripped)",
			input:    "My Project 🚀",
			expected: "my-project",
		},
		{
			name:     "Very long name",
			input:    "This is a very long space name that should still be converted properly",
			expected: "this-is-a-very-long-space-name-that-should-still-be-converted-properly",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateSlug(tt.input)
			if result != tt.expected {
				t.Errorf("GenerateSlug(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestSlugGenerationAndValidation(t *testing.T) {
	// Test that generated slugs always pass validation
	testNames := []string{
		"My Project",
		"John's Space",
		"Version 1.0",
		"Test-Project",
		"My_Underscore_Name",
		"Project 2024",
		"Multi   Space   Name",
	}

	for _, name := range testNames {
		slug := GenerateSlug(name)
		if slug != "" && !ValidateSlug(slug) {
			t.Errorf("Generated slug %q from %q failed validation", slug, name)
		}
	}
}
