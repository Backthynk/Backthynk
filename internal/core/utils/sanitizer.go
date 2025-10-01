package utils

import (
	"github.com/microcosm-cc/bluemonday"
	"github.com/russross/blackfriday/v2"
)

var (
	// HTMLSanitizer is a global sanitizer instance configured for markdown content
	HTMLSanitizer *bluemonday.Policy
)

func init() {
	// Create a policy that allows the same tags as the frontend DOMPurify config
	HTMLSanitizer = bluemonday.NewPolicy()

	// Allow basic text formatting
	HTMLSanitizer.AllowElements(
		"div", "p", "br", "strong", "em", "u", "del", "s", "strike",
	)

	// Allow headings
	HTMLSanitizer.AllowElements("h1", "h2", "h3", "h4", "h5", "h6")

	// Allow lists
	HTMLSanitizer.AllowElements("ul", "ol", "li")

	// Allow blockquotes and code
	HTMLSanitizer.AllowElements("blockquote", "code", "pre")

	// Allow tables
	HTMLSanitizer.AllowElements("table", "thead", "tbody", "tr", "th", "td")

	// Allow horizontal rules
	HTMLSanitizer.AllowElements("hr")

	// Allow links with specific attributes
	HTMLSanitizer.AllowAttrs("href", "title", "target", "rel").OnElements("a")

	// Allow class attributes on all allowed elements
	HTMLSanitizer.AllowAttrs("class").Globally()
}

// SanitizeHTML sanitizes HTML content using the same rules as frontend DOMPurify
func SanitizeHTML(html string) string {
	return HTMLSanitizer.Sanitize(html)
}

// ProcessMarkdown converts markdown to HTML and sanitizes it
func ProcessMarkdown(markdown string) string {
	// Configure markdown renderer with similar options to frontend
	renderer := blackfriday.NewHTMLRenderer(blackfriday.HTMLRendererParameters{
		Flags: blackfriday.CommonHTMLFlags | blackfriday.HrefTargetBlank,
	})

	// Parse markdown
	html := blackfriday.Run([]byte(markdown), blackfriday.WithRenderer(renderer))

	// Sanitize the resulting HTML
	return SanitizeHTML(string(html))
}