package utils

import (
	"bytes"
	"regexp"
	"strings"
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
	// Create a policy that allows the same tags as GitHub's markdown renderer
	HTMLSanitizer = bluemonday.NewPolicy()

	// Allow basic text formatting
	HTMLSanitizer.AllowElements(
		"div", "p", "br", "strong", "em", "u", "del", "s", "strike", "span", "section",
	)

	// Allow headings
	HTMLSanitizer.AllowElements("h1", "h2", "h3", "h4", "h5", "h6")

	// Allow lists
	HTMLSanitizer.AllowElements("ul", "ol", "li")

	// Allow blockquotes and code
	HTMLSanitizer.AllowElements("blockquote", "code", "pre")

	// Allow definition lists
	HTMLSanitizer.AllowElements("dl", "dt", "dd")

	// Allow tables with alignment
	HTMLSanitizer.AllowElements("table", "thead", "tbody", "tr", "th", "td")
	HTMLSanitizer.AllowAttrs("align").OnElements("th", "td")

	// Allow horizontal rules
	HTMLSanitizer.AllowElements("hr")

	// Allow images with GitHub's attributes
	HTMLSanitizer.AllowElements("img")
	HTMLSanitizer.AllowAttrs("src", "alt", "title", "width", "height", "border", "style", "data-canonical-src").OnElements("img")

	// Allow links with GitHub's attributes
	HTMLSanitizer.AllowElements("a")
	HTMLSanitizer.AllowAttrs("href", "title", "target", "rel", "id", "aria-label", "data-footnote-ref", "data-footnote-backref").OnElements("a")

	// Allow sup for footnotes
	HTMLSanitizer.AllowElements("sup")

	// Allow class, id, aria-*, and data-* attributes globally for GitHub compatibility
	HTMLSanitizer.AllowAttrs("class").Globally()
	HTMLSanitizer.AllowAttrs("id").Globally()
	HTMLSanitizer.AllowAttrs("aria-label", "aria-hidden").Globally()
	HTMLSanitizer.AllowAttrs("data-footnotes").OnElements("section")
}

// SanitizeHTML sanitizes HTML content using the same rules as frontend DOMPurify
func SanitizeHTML(html string) string {
	return HTMLSanitizer.Sanitize(html)
}

// ProcessMarkdown converts markdown to HTML and sanitizes it
func ProcessMarkdown(markdown string) string {
	// Configure goldmark with GitHub-style parsing
	// Note: extension.GFM already includes Table, Strikethrough, Linkify, and TaskList
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM, // GitHub Flavored Markdown (includes autolink)
		),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(), // Auto heading IDs
		),
		goldmark.WithRendererOptions(
			html.WithXHTML(),   // XHTML output
			html.WithUnsafe(),  // Allow raw HTML (we sanitize after)
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

	// Autolink bare URLs (goldmark's GFM doesn't autolink http:// URLs consistently)
	// This matches http://, https://, and ftp:// URLs that aren't already in href attributes
	html = autolinkURLs(html)

	// Sanitize the resulting HTML
	return SanitizeHTML(html)
}

// autolinkURLs converts bare URLs in HTML to clickable links
func autolinkURLs(html string) string {
	// Match URLs that appear in text but not in attributes
	// This regex matches http://, https://, and ftp:// URLs
	urlRegex := regexp.MustCompile(`(?i)(?:^|[^"'=])(\b(?:https?|ftp):\/\/[^\s<>"]+)`)

	result := urlRegex.ReplaceAllStringFunc(html, func(match string) string {
		// Find the URL within the match
		submatch := urlRegex.FindStringSubmatch(match)
		if len(submatch) < 2 {
			return match
		}

		url := submatch[1]
		prefix := match[:len(match)-len(url)]

		// Check if we're inside an HTML tag or attribute
		// Count opening and closing tags before this position
		beforeMatch := html[:strings.Index(html, match)]

		// If we're inside a tag (more < than >), don't autolink
		openTags := strings.Count(beforeMatch, "<")
		closeTags := strings.Count(beforeMatch, ">")
		if openTags > closeTags {
			return match
		}

		// Check if this URL is already part of an href attribute
		// Look backwards for href=" without a closing "
		lastHref := strings.LastIndex(beforeMatch, `href="`)
		if lastHref != -1 {
			afterHref := beforeMatch[lastHref:]
			if strings.Count(afterHref, `"`)%2 == 1 {
				// We're inside an href attribute
				return match
			}
		}

		// Create the link
		return prefix + `<a href="` + url + `">` + url + `</a>`
	})

	return result
}