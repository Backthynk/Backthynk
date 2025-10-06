package utils

/*
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
		"<pre",      // Code blocks (may have class attribute)
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

func TestCodeBlockSyntaxHighlighting(t *testing.T) {
    markdown := "```javascript\nfunction test() {}\n```"
    result := ProcessMarkdown(markdown)

    // Should have syntax highlighting classes OR inline styles
    if !strings.Contains(result, "class=") && !strings.Contains(result, "style=") {
        t.Error("Code block missing syntax highlighting")
    }

    // Should have pre and code tags (allow pre with attributes like <pre class="...">)
    if !strings.Contains(result, "<pre") || !strings.Contains(result, "<code") {
        t.Errorf("Code block missing pre/code tags. Got: %s", result)
    }
}

func TestMultipleLanguages(t *testing.T) {
    languages := []struct {
        lang string
        code string
        expectedClass string
    }{
        {"javascript", "function test() {}", "pl-k"}, // keyword
        {"python", "def test():", "pl-k"},
        {"go", "func test() {}", "pl-k"},
    }

    for _, tt := range languages {
        markdown := "```" + tt.lang + "\n" + tt.code + "\n```"
        result := ProcessMarkdown(markdown)

        if !strings.Contains(result, tt.expectedClass) && !strings.Contains(result, "color:") {
            t.Errorf("Language %s: expected highlighting class %s or inline styles", tt.lang, tt.expectedClass)
        }
    }
}

func TestTaskLists(t *testing.T) {
	tests := []struct {
		name     string
		markdown string
		contains []string
	}{
		{
			name:     "Checked task",
			markdown: "- [x] Completed task",
			contains: []string{"<input", "type=\"checkbox\"", "checked", "Completed task"},
		},
		{
			name:     "Unchecked task",
			markdown: "- [ ] Incomplete task",
			contains: []string{"<input", "type=\"checkbox\"", "Incomplete task"},
		},
		{
			name: "Multiple tasks",
			markdown: `- [x] Task 1
- [ ] Task 2
- [x] Task 3`,
			contains: []string{"<input", "type=\"checkbox\"", "checked", "Task 1", "Task 2", "Task 3"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ProcessMarkdown(tt.markdown)
			for _, substr := range tt.contains {
				if !strings.Contains(result, substr) {
					t.Errorf("ProcessMarkdown(%q) should contain %q\nGot: %s", tt.markdown, substr, result)
				}
			}
		})
	}
}

// TestProcessMarkdownComprehensive tests ProcessMarkdown with comprehensive markdown
// Note: We don't expect exact match with GitHub's HTML since we use goldmark, not GitHub's renderer
// Instead, we verify all key markdown features are rendered correctly
func TestProcessMarkdownComprehensive(t *testing.T) {
	// Read the markdown file
	mdPath := filepath.Join("markdown", "_markdown-example.md")
	markdownBytes, err := os.ReadFile(mdPath)
	if err != nil {
		t.Fatalf("Failed to read markdown file: %v", err)
	}

	markdown := string(markdownBytes)

	// Process the markdown
	actual := ProcessMarkdown(markdown)

	// Write actual output for debugging
	debugPath := filepath.Join("markdown", "_actual-output.html")
	os.WriteFile(debugPath, []byte(actual), 0644)

	// Test that all key markdown elements are present and functional
	requiredElements := map[string][]string{
		"Headings with IDs": {
			`<h1 id="headers">Headers</h1>`,
			`<h2 id="h2-heading">h2 Heading</h2>`,
			`<h3 id="h3-heading">h3 Heading</h3>`,
		},
		"Text formatting": {
			"<strong>asterisks</strong>",
			"<em>asterisks</em>",
			"<del>Scratch this.</del>",
		},
		"Code blocks with syntax highlighting": {
			"<pre",
			"<code",
			"class=\"pl-", // GitHub-style class prefix
		},
		"Inline code": {
			"<code>code</code>",
			"<code>back-ticks around</code>",
		},
		"Lists": {
			"<ol>",
			"<ul>",
			"<li>",
		},
		"Task lists": {
			"<input",
			"type=\"checkbox\"",
			"checked",
		},
		"Links": {
			`href="https://www.google.com"`,
			`href="http://slashdot.org"`,
		},
		"Autolinked URLs": {
			`<a href="http://www.example.com">http://www.example.com</a>`,
		},
		"Images": {
			"<img",
			`src="https://github.com/adam-p/markdown-here/raw/master/src/common/images/icon48.png"`,
			`alt="alt text"`,
		},
		"Tables": {
			"<table>",
			"<thead>",
			"<tbody>",
			"<th>",
			"<td>",
			`align="center"`,
			`align="right"`,
		},
		"Blockquotes": {
			"<blockquote>",
			"Blockquotes are very handy",
		},
		"Horizontal rules": {
			"<hr",
		},
		"Definition lists": {
			"<dl>",
			"<dt>Definition list</dt>",
			"<dd>Is something people use sometimes.</dd>",
		},
		"Escaped characters": {
			"*our-new-project*",
		},
		"Footnotes": {
			"<sup",
			"footnote-ref",
			"footnote-backref",
			`<div class="footnotes">`,
		},
	}

	for feature, elements := range requiredElements {
		for _, element := range elements {
			if !strings.Contains(actual, element) {
				t.Errorf("Feature %q missing expected element: %s", feature, element)
			}
		}
	}

	// Verify the output is substantial
	if len(actual) < 5000 {
		t.Errorf("ProcessMarkdown output seems too short: %d bytes (expected >5000)", len(actual))
	}

	// Test that no unsafe content gets through
	unsafeElements := []string{
		"<script",
		"onclick=",
		"onerror=",
		"javascript:",
	}

	for _, unsafe := range unsafeElements {
		if strings.Contains(strings.ToLower(actual), strings.ToLower(unsafe)) {
			t.Errorf("ProcessMarkdown output contains unsafe element: %s", unsafe)
		}
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

*/