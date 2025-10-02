package utils

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestProcessMarkdownWithGitHubExample tests markdown processing with GitHub example
func TestProcessMarkdownWithGitHubExample(t *testing.T) {
	// Read the markdown file
	mdPath := filepath.Join("markdown", "_markdown-example.md")
	markdownBytes, err := os.ReadFile(mdPath)
	if err != nil {
		t.Fatalf("Failed to read markdown file: %v", err)
	}

	markdown := string(markdownBytes)

	// Process the markdown
	result := ProcessMarkdown(markdown)

	// Test that key markdown elements are properly converted
	requiredElements := []string{
		"<h1",       // Headings
		"<h2",
		"<strong>",  // Bold
		"<em>",      // Italic
		"<del>",     // Strikethrough
		"<code>",    // Inline code
		"<pre>",     // Code blocks
		"<ul>",      // Unordered lists
		"<ol>",      // Ordered lists
		"<li>",      // List items
		"<a href",   // Links
		"<blockquote>", // Blockquotes
		"<table>",   // Tables
		"<hr",       // Horizontal rules
	}

	for _, element := range requiredElements {
		if !strings.Contains(result, element) {
			t.Errorf("ProcessMarkdown output missing expected element: %s", element)
		}
	}

	// Verify the output is not empty and has reasonable length
	if len(result) < 1000 {
		t.Errorf("ProcessMarkdown output seems too short: %d bytes", len(result))
	}

	// Test that no unsafe content gets through
	unsafeElements := []string{
		"<script",
		"onclick=",
		"onerror=",
		"javascript:",
	}

	for _, unsafe := range unsafeElements {
		if strings.Contains(strings.ToLower(result), strings.ToLower(unsafe)) {
			t.Errorf("ProcessMarkdown output contains unsafe element: %s", unsafe)
		}
	}
}

// TestSanitizeGitHubHTML tests that GitHub's HTML passes through sanitization
func TestSanitizeGitHubHTML(t *testing.T) {
	// Read the GitHub HTML
	htmlPath := filepath.Join("markdown", "_markdown-example.html")
	htmlBytes, err := os.ReadFile(htmlPath)
	if err != nil {
		t.Fatalf("Failed to read GitHub HTML file: %v", err)
	}

	githubHTML := string(htmlBytes)

	// Sanitize it
	result := SanitizeHTML(githubHTML)

	// The result should preserve most of GitHub's structure
	// We'll check for key GitHub-specific classes and attributes
	githubFeatures := []string{
		"markdown-heading",        // GitHub heading wrapper class
		"highlight",              // Code highlighting
		"data-footnotes",         // Footnotes
		"aria-label",             // Accessibility
		"align=",                 // Table alignment
		"class=",                 // Classes preserved
	}

	for _, feature := range githubFeatures {
		if strings.Contains(githubHTML, feature) && !strings.Contains(result, feature) {
			t.Errorf("SanitizeHTML removed GitHub feature: %s", feature)
		}
	}

	// Make sure it's not empty
	if len(result) < len(githubHTML)/2 {
		t.Errorf("SanitizeHTML removed too much content: original %d bytes, result %d bytes", len(githubHTML), len(result))
	}
}

// TestSanitizeHTMLPreservesGitHubStructure tests that sanitization preserves GitHub's HTML structure
func TestSanitizeHTMLPreservesGitHubStructure(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "GitHub heading with wrapper",
			input:    `<div class="markdown-heading"><h1 class="heading-element">Test</h1><a id="user-content-test" class="anchor" aria-label="Permalink: Test" href="#test"><span aria-hidden="true" class="octicon octicon-link"></span></a></div>`,
			expected: `<div class="markdown-heading"><h1 class="heading-element">Test</h1><a id="user-content-test" class="anchor" aria-label="Permalink: Test" href="#test"><span aria-hidden="true" class="octicon octicon-link"></span></a></div>`,
		},
		{
			name:     "GitHub image with style",
			input:    `<img src="test.png" alt="test" style="max-width: 100%;">`,
			expected: `<img src="test.png" alt="test" style="max-width: 100%;">`,
		},
		{
			name:     "GitHub link with rel attribute",
			input:    `<a href="https://example.com" rel="nofollow">Link</a>`,
			expected: `<a href="https://example.com" rel="nofollow">Link</a>`,
		},
		{
			name:     "Table with alignment",
			input:    `<table><thead><tr><th align="center">Header</th></tr></thead><tbody><tr><td align="center">Cell</td></tr></tbody></table>`,
			expected: `<table><thead><tr><th align="center">Header</th></tr></thead><tbody><tr><td align="center">Cell</td></tr></tbody></table>`,
		},
		{
			name:     "Code block with syntax highlighting classes",
			input:    `<div class="highlight highlight-source-js"><pre><span class="pl-k">function</span> <span class="pl-en">test</span><span class="pl-kos">(</span><span class="pl-kos">)</span> <span class="pl-kos">{</span><span class="pl-kos">}</span></pre></div>`,
			expected: `<div class="highlight highlight-source-js"><pre><span class="pl-k">function</span> <span class="pl-en">test</span><span class="pl-kos">(</span><span class="pl-kos">)</span> <span class="pl-kos">{</span><span class="pl-kos">}</span></pre></div>`,
		},
		{
			name:     "Footnotes section",
			input:    `<section data-footnotes=""><ol><li id="user-content-fn-1"><p>Footnote text. <a href="#fnref-1" data-footnote-backref="" aria-label="Back to reference 1">↩</a></p></li></ol></section>`,
			expected: `<section data-footnotes=""><ol><li id="user-content-fn-1"><p>Footnote text. <a href="#fnref-1" data-footnote-backref="" aria-label="Back to reference 1">↩</a></p></li></ol></section>`,
		},
		{
			name:     "Definition list",
			input:    `<dl><dt>Term</dt><dd>Definition</dd></dl>`,
			expected: `<dl><dt>Term</dt><dd>Definition</dd></dl>`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeHTML(tt.input)
			if normalizeHTML(result) != normalizeHTML(tt.expected) {
				t.Errorf("SanitizeHTML() = %q, want %q", result, tt.expected)
			}
		})
	}
}

// TestProcessMarkdownBasicElements tests individual markdown elements
func TestProcessMarkdownBasicElements(t *testing.T) {
	tests := []struct {
		name     string
		markdown string
		contains []string // Substrings that should be in the output
	}{
		{
			name:     "Bold text",
			markdown: "**bold**",
			contains: []string{"<strong>bold</strong>"},
		},
		{
			name:     "Italic text",
			markdown: "*italic*",
			contains: []string{"<em>italic</em>"},
		},
		{
			name:     "Strikethrough",
			markdown: "~~strikethrough~~",
			contains: []string{"<del>strikethrough</del>"},
		},
		{
			name:     "Code inline",
			markdown: "`code`",
			contains: []string{"<code>code</code>"},
		},
		{
			name:     "Link",
			markdown: "[text](https://example.com)",
			contains: []string{"<a", "href=\"https://example.com\"", ">text</a>"},
		},
		{
			name:     "Unordered list",
			markdown: "- item 1\n- item 2",
			contains: []string{"<ul>", "<li>item 1</li>", "<li>item 2</li>", "</ul>"},
		},
		{
			name:     "Ordered list",
			markdown: "1. first\n2. second",
			contains: []string{"<ol>", "<li>first</li>", "<li>second</li>", "</ol>"},
		},
		{
			name:     "Blockquote",
			markdown: "> quote",
			contains: []string{"<blockquote>", "<p>quote</p>", "</blockquote>"},
		},
		{
			name:     "Horizontal rule",
			markdown: "---",
			contains: []string{"<hr"},
		},
		{
			name:     "Table",
			markdown: "| A | B |\n|---|---|\n| 1 | 2 |",
			contains: []string{"<table>", "<thead>", "<th>A</th>", "<th>B</th>", "<tbody>", "<td>1</td>", "<td>2</td>"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ProcessMarkdown(tt.markdown)
			for _, substr := range tt.contains {
				if !strings.Contains(result, substr) {
					t.Errorf("ProcessMarkdown(%q) should contain %q, got: %q", tt.markdown, substr, result)
				}
			}
		})
	}
}

// TestAutoLinkURLs tests that bare URLs are converted to clickable links
func TestAutoLinkURLs(t *testing.T) {
	tests := []struct {
		name     string
		markdown string
		contains []string
		mustHave string // The exact URL that must be linked
	}{
		{
			name:     "HTTP URL in text",
			markdown: "Open http://localhost:8080 in your browser",
			mustHave: `<a href="http://localhost:8080">http://localhost:8080</a>`,
		},
		{
			name:     "HTTPS URL in text",
			markdown: "Visit https://example.com for more info",
			mustHave: `<a href="https://example.com">https://example.com</a>`,
		},
		{
			name:     "HTTP URL in list",
			markdown: "1. Open http://localhost:8080\n2. Test it",
			mustHave: `<a href="http://localhost:8080">http://localhost:8080</a>`,
		},
		{
			name:     "Multiple URLs",
			markdown: "Check http://localhost:8080 and https://example.com",
			contains: []string{
				`<a href="http://localhost:8080">http://localhost:8080</a>`,
				`<a href="https://example.com">https://example.com</a>`,
			},
		},
		{
			name:     "URL in markdown link should not double-link",
			markdown: "[Click here](http://example.com)",
			contains: []string{`href="http://example.com"`},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ProcessMarkdown(tt.markdown)

			if tt.mustHave != "" {
				if !strings.Contains(result, tt.mustHave) {
					t.Errorf("ProcessMarkdown(%q) should contain %q\nGot: %s", tt.markdown, tt.mustHave, result)
				}
			}

			for _, substr := range tt.contains {
				if !strings.Contains(result, substr) {
					t.Errorf("ProcessMarkdown(%q) should contain %q\nGot: %s", tt.markdown, substr, result)
				}
			}
		})
	}
}

// normalizeHTML normalizes HTML for comparison by removing extra whitespace
func normalizeHTML(html string) string {
	// Trim leading/trailing whitespace
	html = strings.TrimSpace(html)

	// Normalize line endings
	html = strings.ReplaceAll(html, "\r\n", "\n")

	return html
}
