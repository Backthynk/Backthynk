package utils

import (
	"bytes"
	"regexp"
	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
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

	// Allow class attributes on code elements for syntax highlighting
	HTMLSanitizer.AllowAttrs("class").OnElements("code", "pre")

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
	// Configure goldmark with GitHub-style parsing
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,        // GitHub Flavored Markdown
			extension.Table,      // Tables
			extension.Strikethrough, // Strikethrough
			extension.Linkify,    // Auto-linking
			extension.TaskList,   // Task lists
		),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(), // Auto heading IDs
		),
		goldmark.WithRendererOptions(
			html.WithXHTML(),         // XHTML output
			html.WithUnsafe(),        // Allow raw HTML (we sanitize after)
		),
	)

	var buf bytes.Buffer
	if err := md.Convert([]byte(markdown), &buf); err != nil {
		// Fallback to escaped text if parsing fails
		return SanitizeHTML(markdown)
	}

	// Clean up unwanted paragraph tags in list items
	html := buf.String()

	// Remove <p> tags that are the only content in <li> tags
	// First handle: <li>\n<p>content</p>\n</li>
	listItemParagraphRegex := regexp.MustCompile(`(<li[^>]*>)\s*<p>(.*?)</p>\s*(</li>)`)
	html = listItemParagraphRegex.ReplaceAllString(html, "$1$2$3")

	// Handle: <li><p>content</p> followed by other elements
	listItemStartParagraphRegex := regexp.MustCompile(`(<li[^>]*>)\s*<p>([^<]*)</p>(\s*<(?:pre|code|ul|ol))`)
	html = listItemStartParagraphRegex.ReplaceAllString(html, "$1$2$3")

	// Sanitize the resulting HTML
	return SanitizeHTML(html)
}