package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Configuration structures matching _script.json
type Config struct {
	CSSExtraction struct {
		Tailwind struct {
			CDNURL     string `json:"cdn_url"`
			FullCSSURL string `json:"full_css_url"`
			OutputFile string `json:"output_file"`
			CacheFile  string `json:"cache_file"`
		} `json:"tailwind"`
		FontAwesome struct {
			CDNURL     string `json:"cdn_url"`
			FontURL    string `json:"font_url"`
			OutputFile string `json:"output_file"`
			FontOutput string `json:"font_output"`
		} `json:"fontawesome"`
		PurgeCSS struct {
			TempContentFile string `json:"temp_content_file"`
		} `json:"purgecss"`
		ScanPatterns    []string `json:"scan_patterns"`
		ExcludePatterns []string `json:"exclude_patterns"`
		CacheFile       string   `json:"cache_file"`
		ExtractCSSDir   string   `json:"extract_css_dir"`
	} `json:"css_extraction"`
	Paths struct {
		WebRoot       string `json:"web_root"`
		StaticRoot    string `json:"static_root"`
		TemplatesRoot string `json:"templates_root"`
		ScriptsRoot   string `json:"scripts_root"`
		CSSDir        string `json:"css_dir"`
		JSDir         string `json:"js_dir"`
		FontsDir      string `json:"fonts_dir"`
	} `json:"paths"`
}

type ExtractionCache struct {
	ScannedClasses []string `json:"scanned_classes"`
	ScannedIcons   []string `json:"scanned_icons"`
	LastScan       int64    `json:"last_scan"`
}

var config Config

func main() {
	fmt.Println("🔍 Scanning codebase for used CSS classes and icons...")

	// Load configuration
	if err := loadConfig(); err != nil {
		fmt.Printf("Error loading configuration: %v\n", err)
		os.Exit(1)
	}

	// Scan for classes and icons dynamically
	classes := scanForClasses()
	icons := scanForIcons()

	fmt.Printf("📊 Found %d Tailwind classes and %d Font Awesome icons\n", len(classes), len(icons))

	// Save scan results for comparison
	cache := ExtractionCache{
		ScannedClasses: classes,
		ScannedIcons:   icons,
		LastScan:       time.Now().Unix(),
	}
	saveCache(cache)

	// Download Tailwind CSS and extract only the classes we need
	tailwindCSS := downloadTailwindFromCDN()
	var tailwindOutput string
	if tailwindCSS != "" {
		tailwindOutput = extractUsedTailwindCSS(tailwindCSS, classes)
	}

	// Generate FontAwesome CSS
	faOutput := generateFACSS(icons)
	fontPath := downloadFAFont()

	// Generate stats
	fmt.Println("\n📈 CSS Extraction Results:")
	fmt.Println(strings.Repeat("=", 40))

	totalSize := int64(0)

	if tailwindOutput != "" {
		if stat, err := os.Stat(tailwindOutput); err == nil {
			fmt.Printf("Tailwind CSS: %s bytes (minimal)\n", formatBytes(stat.Size()))
			totalSize += stat.Size()
		}
	}

	if faOutput != "" {
		if stat, err := os.Stat(faOutput); err == nil {
			fmt.Printf("Font Awesome: %s bytes (minimal)\n", formatBytes(stat.Size()))
			totalSize += stat.Size()
		}
	}

	if fontPath != "" {
		if stat, err := os.Stat(fontPath); err == nil {
			fmt.Printf("FA Font:      %s bytes\n", formatBytes(stat.Size()))
			totalSize += stat.Size()
		}
	}

	// Calculate savings
	cdnSize := int64(4700000) // ~4.7MB estimated
	if totalSize > 0 {
		fmt.Printf("\nTotal minimal: %s bytes\n", formatBytes(totalSize))
		fmt.Printf("CDN size:      %s bytes (estimated)\n", formatBytes(cdnSize))
		savings := float64(cdnSize-totalSize) / float64(cdnSize) * 100
		fmt.Printf("Savings:       %.1f%%\n", savings)
	}

	fmt.Println("\n✅ CSS extraction complete!")
	fmt.Println("Update your HTML to use the minimal CSS files.")
}

func loadConfig() error {
	// Look for config file relative to script location
	configPath := filepath.Join("scripts", "_script.json")

	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file %s: %w", configPath, err)
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse config file: %w", err)
	}

	return nil
}


func scanForClasses() []string {
	classSet := make(map[string]bool)
	fmt.Println("📁 Scanning for Tailwind classes...")

	// Scan HTML and JS files
	err := filepath.Walk(config.Paths.WebRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// Check if path should be excluded
		for _, exclude := range config.CSSExtraction.ExcludePatterns {
			if strings.Contains(path, strings.TrimSuffix(exclude, "/**")) {
				return nil
			}
		}

		// Only process HTML and JS files
		if strings.HasSuffix(path, ".html") || strings.HasSuffix(path, ".js") {
			fmt.Printf("   Scanning: %s\n", path)
			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}

			extractClassesFromContent(string(content), classSet)
		}

		return nil
	})

	if err != nil {
		fmt.Printf("Warning: Error walking directory: %v\n", err)
	}

	// Also scan main.css for any Tailwind classes used in CSS
	mainCSSPath := filepath.Join(config.Paths.CSSDir, "main.css")
	if content, err := os.ReadFile(mainCSSPath); err == nil {
		fmt.Printf("   Scanning: %s\n", mainCSSPath)
		extractClassesFromContent(string(content), classSet)
	}

	var classes []string
	for class := range classSet {
		classes = append(classes, class)
	}
	sort.Strings(classes)

	return classes
}

func extractClassesFromContent(content string, classSet map[string]bool) {
	// Extract class attributes (HTML)
	classRegex := regexp.MustCompile(`class="([^"]*)"`)
	classMatches := classRegex.FindAllStringSubmatch(content, -1)
	for _, match := range classMatches {
		classes := strings.Fields(match[1])
		for _, class := range classes {
			if isTailwindClass(class) {
				classSet[class] = true
			}
		}
	}

	// Extract className assignments (JavaScript)
	jsClassRegex := regexp.MustCompile(`className\s*=\s*["']([^"']*)["']`)
	jsMatches := jsClassRegex.FindAllStringSubmatch(content, -1)
	for _, match := range jsMatches {
		classes := strings.Fields(match[1])
		for _, class := range classes {
			if isTailwindClass(class) {
				classSet[class] = true
			}
		}
	}

	// Extract from CSS selectors (e.g., .bg-blue-500)
	cssClassRegex := regexp.MustCompile(`\.([a-zA-Z0-9_:-]+)`)
	cssMatches := cssClassRegex.FindAllStringSubmatch(content, -1)
	for _, match := range cssMatches {
		if isTailwindClass(match[1]) {
			classSet[match[1]] = true
		}
	}
}

func scanForIcons() []string {
	iconSet := make(map[string]bool)

	err := filepath.Walk(config.Paths.WebRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// Check if path should be excluded
		for _, exclude := range config.CSSExtraction.ExcludePatterns {
			if strings.Contains(path, strings.TrimSuffix(exclude, "/**")) {
				return nil
			}
		}

		if strings.HasSuffix(path, ".html") || strings.HasSuffix(path, ".js") {
			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}

			extractIconsFromContent(string(content), iconSet)
		}

		return nil
	})

	// Also scan main.css for FontAwesome icons
	mainCSSPath := filepath.Join(config.Paths.CSSDir, "main.css")
	if content, err := os.ReadFile(mainCSSPath); err == nil {
		extractIconsFromContent(string(content), iconSet)
	}

	if err != nil {
		fmt.Printf("Warning: Error scanning for icons: %v\n", err)
	}

	var icons []string
	for icon := range iconSet {
		icons = append(icons, icon)
	}
	sort.Strings(icons)

	return icons
}

func extractIconsFromContent(content string, iconSet map[string]bool) {
	// Find fa-* classes, but avoid template literals and incomplete patterns
	iconRegex := regexp.MustCompile(`fa-([a-zA-Z0-9-]+[a-zA-Z0-9])`)
	iconMatches := iconRegex.FindAllStringSubmatch(content, -1)
	for _, match := range iconMatches {
		iconName := match[1]
		// Skip CSS modifier classes and ensure it doesn't end with a dash
		if !isIconModifier(iconName) && !strings.HasSuffix(iconName, "-") {
			// Skip standalone "chevron" as it's not a valid FontAwesome icon
			if iconName != "chevron" {
				iconSet[iconName] = true
			}
		}
	}

	// Also handle template literal patterns like fa-chevron-${variable}
	// Extract the base patterns and add common variants
	templateRegex := regexp.MustCompile(`fa-([a-zA-Z0-9-]+)-\$\{[^}]*\}`)
	templateMatches := templateRegex.FindAllStringSubmatch(content, -1)
	for _, match := range templateMatches {
		baseName := match[1]
		// For chevron patterns, add common directions (but don't add the base name)
		if baseName == "chevron" {
			iconSet["chevron-up"] = true
			iconSet["chevron-down"] = true
			iconSet["chevron-left"] = true
			iconSet["chevron-right"] = true
			// Don't add "chevron" itself as it's not a valid icon
		}
		// Add other common template patterns as needed
	}
}

func isIconModifier(iconName string) bool {
	modifiers := []string{
		"spin", "pulse", "fw", "lg", "xs", "sm", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x",
		"rotate-90", "rotate-180", "rotate-270", "flip-horizontal", "flip-vertical", "flip-both",
		"border", "pull-left", "pull-right", "stack", "stack-1x", "stack-2x", "inverse",
	}

	for _, modifier := range modifiers {
		if iconName == modifier {
			return true
		}
	}

	return false
}

func isTailwindClass(class string) bool {
	// Define comprehensive Tailwind prefixes based on actual Tailwind CSS
	prefixes := []string{
		// Layout
		"container", "box-", "block", "inline", "flex", "grid", "table", "hidden", "visible", "invisible",

		// Spacing
		"p-", "pt-", "pr-", "pb-", "pl-", "px-", "py-", "m-", "mt-", "mr-", "mb-", "ml-", "mx-", "my-",
		"space-x-", "space-y-",

		// Sizing
		"w-", "min-w-", "max-w-", "h-", "min-h-", "max-h-",

		// Typography
		"text-", "font-", "leading-", "tracking-", "line-", "list-", "placeholder-",

		// Backgrounds
		"bg-", "from-", "via-", "to-", "bg-gradient-",

		// Borders
		"border", "border-", "rounded", "rounded-",

		// Effects
		"shadow", "shadow-", "opacity-", "mix-", "backdrop-",

		// Filters
		"blur", "brightness-", "contrast-", "drop-shadow", "grayscale", "hue-rotate-", "invert", "saturate-", "sepia",

		// Tables
		"border-collapse", "border-separate", "table-auto", "table-fixed",

		// Transforms
		"transform", "origin-", "scale-", "rotate-", "translate-", "skew-", "transform-",

		// Interactivity
		"resize", "select-", "appearance-", "cursor-", "outline-", "pointer-events-",

		// SVG
		"fill-", "stroke-",

		// Accessibility
		"sr-only", "not-sr-only",

		// Colors (dynamic)
		"red-", "blue-", "green-", "yellow-", "purple-", "pink-", "indigo-", "gray-", "grey-",
		"slate-", "zinc-", "neutral-", "stone-", "orange-", "amber-", "lime-", "emerald-",
		"teal-", "cyan-", "sky-", "violet-", "fuchsia-", "rose-",

		// Positioning
		"static", "fixed", "absolute", "relative", "sticky", "top-", "right-", "bottom-", "left-",
		"inset-", "z-",

		// Flexbox & Grid
		"justify-", "items-", "content-", "self-", "flex-", "grow", "shrink", "order-",
		"grid-cols-", "col-", "grid-rows-", "row-", "gap-",

		// Overflow
		"overflow-", "overscroll-",

		// Transitions & Animation
		"transition", "duration-", "ease-", "delay-", "animate-",
	}

	// Check for exact matches first
	exactMatches := []string{
		"container", "sr-only", "not-sr-only", "group", "peer",
	}

	for _, exact := range exactMatches {
		if class == exact {
			return true
		}
	}

	// Check prefixes
	for _, prefix := range prefixes {
		if strings.HasPrefix(class, prefix) {
			return true
		}
	}

	// Check for state prefixes (hover:, focus:, etc.)
	statePrefixes := []string{"hover:", "focus:", "active:", "disabled:", "visited:", "first:", "last:", "odd:", "even:",
		"peer-", "group-", "focus-within:", "focus-visible:"}
	for _, statePrefix := range statePrefixes {
		if strings.HasPrefix(class, statePrefix) {
			// Check if the rest is a Tailwind class
			remainder := strings.TrimPrefix(class, statePrefix)
			return isTailwindClass(remainder)
		}
	}

	// Check for responsive prefixes
	responsivePrefixes := []string{"sm:", "md:", "lg:", "xl:", "2xl:"}
	for _, respPrefix := range responsivePrefixes {
		if strings.HasPrefix(class, respPrefix) {
			remainder := strings.TrimPrefix(class, respPrefix)
			return isTailwindClass(remainder)
		}
	}

	return false
}

func downloadTailwindFromCDN() string {
	// Check if cache file exists first
	if _, err := os.Stat(config.CSSExtraction.Tailwind.CacheFile); err == nil {
		fmt.Printf("✓ Using cached Tailwind CSS: %s\n", config.CSSExtraction.Tailwind.CacheFile)
		return config.CSSExtraction.Tailwind.CacheFile
	}

	// Use full CSS URL to get the actual CSS content
	fmt.Println("📦 Downloading Tailwind CSS from unpkg...")

	resp, err := http.Get(config.CSSExtraction.Tailwind.FullCSSURL)
	if err != nil {
		fmt.Printf("Error: Could not download Tailwind CSS: %v\n", err)
		return ""
	}
	defer resp.Body.Close()

	os.MkdirAll(filepath.Dir(config.CSSExtraction.Tailwind.CacheFile), 0755)
	file, err := os.Create(config.CSSExtraction.Tailwind.CacheFile)
	if err != nil {
		fmt.Printf("Error: Could not create Tailwind file: %v\n", err)
		return ""
	}
	defer file.Close()

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		fmt.Printf("Error: Could not download Tailwind CSS: %v\n", err)
		return ""
	}

	fmt.Printf("✓ Tailwind CSS downloaded to %s\n", config.CSSExtraction.Tailwind.CacheFile)
	return config.CSSExtraction.Tailwind.CacheFile
}

func extractUsedTailwindCSS(fullCSSPath string, classes []string) string {
	if len(classes) == 0 {
		fmt.Println("ℹ️  No Tailwind classes found, skipping Tailwind CSS generation")
		return ""
	}

	fmt.Printf("🎨 Extracting CSS rules for %d classes from full Tailwind CSS...\n", len(classes))

	// Read the full CSS file
	content, err := os.ReadFile(fullCSSPath)
	if err != nil {
		fmt.Printf("Error reading Tailwind CSS file: %v\n", err)
		return ""
	}

	cssText := string(content)

	// Extract CSS rules for our classes
	var extractedCSS strings.Builder
	extractedCSS.WriteString("/* Custom Tailwind CSS - Extracted from your codebase */\n")

	foundRules := 0
	classSet := make(map[string]bool)
	for _, class := range classes {
		classSet[class] = true
	}

	// Simple CSS rule extraction using regex
	// This looks for .classname { ... } patterns
	for class := range classSet {
		pattern := regexp.MustCompile(fmt.Sprintf(`\.%s\s*\{[^}]*\}`, regexp.QuoteMeta(class)))
		matches := pattern.FindAllString(cssText, -1)

		for _, match := range matches {
			extractedCSS.WriteString(match)
			extractedCSS.WriteString("\n")
			foundRules++
		}
	}

	// Also look for responsive and state variants
	for class := range classSet {
		// Look for responsive variants: @media (...) { .class { ... } }
		mediaPattern := regexp.MustCompile(fmt.Sprintf(`@media[^{]*\{[^{}]*\.%s\s*\{[^}]*\}[^}]*\}`, regexp.QuoteMeta(class)))
		mediaMatches := mediaPattern.FindAllString(cssText, -1)

		for _, match := range mediaMatches {
			extractedCSS.WriteString(match)
			extractedCSS.WriteString("\n")
			foundRules++
		}
	}

	if foundRules == 0 {
		fmt.Println("⚠️  No CSS rules found for the detected classes")
		return ""
	}

	// Write the extracted CSS
	os.MkdirAll(filepath.Dir(config.CSSExtraction.Tailwind.OutputFile), 0755)
	err = os.WriteFile(config.CSSExtraction.Tailwind.OutputFile, []byte(extractedCSS.String()), 0644)
	if err != nil {
		fmt.Printf("Error writing extracted Tailwind CSS: %v\n", err)
		return ""
	}

	if stat, err := os.Stat(config.CSSExtraction.Tailwind.OutputFile); err == nil {
		fmt.Printf("✓ Generated %s (%d bytes, %d rules)\n", config.CSSExtraction.Tailwind.OutputFile, stat.Size(), foundRules)
		return config.CSSExtraction.Tailwind.OutputFile
	}

	return ""
}


func generateFACSS(icons []string) string {
	if len(icons) == 0 {
		fmt.Println("ℹ️  No FontAwesome icons found, skipping FontAwesome CSS generation")
		return ""
	}

	os.MkdirAll(filepath.Dir(config.CSSExtraction.FontAwesome.OutputFile), 0755)

	// Get FontAwesome icon codes from the CDN CSS
	iconCodes := getFAIconCodes()

	// Font face declaration
	cssContent := `@font-face {
    font-family: 'Font Awesome 6 Free';
    src: url('../fonts/fa-solid-900.woff2') format('woff2');
    font-weight: 900;
    font-style: normal;
    font-display: swap;
}

.fas {
    font-family: 'Font Awesome 6 Free';
    font-weight: 900;
    font-style: normal;
    font-variant: normal;
    text-rendering: auto;
    line-height: 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

`

	// Add icon definitions
	hasSpinner := false
	foundIcons := 0
	missingIcons := []string{}

	for _, icon := range icons {
		if code, exists := iconCodes[icon]; exists {
			cssContent += fmt.Sprintf(".fa-%s:before { content: \"\\%s\"; }\n", icon, code)
			foundIcons++
			if icon == "spinner" {
				hasSpinner = true
			}
		} else {
			missingIcons = append(missingIcons, icon)
		}
	}

	// Fail hard if any icons are missing
	if len(missingIcons) > 0 {
		fmt.Printf("❌ Error: The following icons were not found in FontAwesome CSS:\n")
		for _, icon := range missingIcons {
			fmt.Printf("   - fa-%s\n", icon)
		}
		fmt.Printf("\nScript failed due to missing icons. Please check your icon names.\n")
		os.Exit(1)
	}

	// Add fa-spin animation if spinner is used
	if hasSpinner {
		cssContent += `
.fa-spin {
    animation: fa-spin 2s infinite linear;
}

@keyframes fa-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`
	}

	err := os.WriteFile(config.CSSExtraction.FontAwesome.OutputFile, []byte(cssContent), 0644)
	if err != nil {
		fmt.Printf("Error writing FA CSS: %v\n", err)
		return ""
	}

	if stat, err := os.Stat(config.CSSExtraction.FontAwesome.OutputFile); err == nil {
		fmt.Printf("✓ Generated %s (%d bytes, %d icons)\n", config.CSSExtraction.FontAwesome.OutputFile, stat.Size(), foundIcons)
		return config.CSSExtraction.FontAwesome.OutputFile
	}

	return ""
}

func getFAIconCodes() map[string]string {
	iconCodes := make(map[string]string)

	// Download FontAwesome CSS to extract icon codes
	resp, err := http.Get(config.CSSExtraction.FontAwesome.CDNURL)
	if err != nil {
		fmt.Printf("Warning: Could not download FontAwesome CSS: %v\n", err)
		return iconCodes
	}
	defer resp.Body.Close()

	cssContent, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Warning: Could not read FontAwesome CSS: %v\n", err)
		return iconCodes
	}

	// Extract icon codes using regex - handle multiple class names per rule
	iconRegex := regexp.MustCompile(`\.fa-([a-zA-Z0-9-]+)[^{]*:before[^{]*\{content:"\\([^"]+)"`)
	matches := iconRegex.FindAllStringSubmatch(string(cssContent), -1)

	for _, match := range matches {
		if len(match) >= 3 {
			iconName := match[1]
			iconCode := match[2]
			iconCodes[iconName] = iconCode
		}
	}

	// Also handle cases where multiple classes share the same rule (comma-separated)
	multiIconRegex := regexp.MustCompile(`((?:\.fa-[a-zA-Z0-9-]+(?::before)?[^,{]*,?\s*)+)\{content:"\\([^"]+)"`)
	multiMatches := multiIconRegex.FindAllStringSubmatch(string(cssContent), -1)

	for _, match := range multiMatches {
		if len(match) >= 3 {
			classesStr := match[1]
			iconCode := match[2]

			// Extract individual class names from the comma-separated list
			classRegex := regexp.MustCompile(`\.fa-([a-zA-Z0-9-]+)`)
			classMatches := classRegex.FindAllStringSubmatch(classesStr, -1)

			for _, classMatch := range classMatches {
				if len(classMatch) >= 2 {
					iconName := classMatch[1]
					iconCodes[iconName] = iconCode
				}
			}
		}
	}

	fmt.Printf("✓ Extracted %d FontAwesome icon codes from CDN\n", len(iconCodes))
	return iconCodes
}

func downloadFAFont() string {
	os.MkdirAll(filepath.Dir(config.CSSExtraction.FontAwesome.FontOutput), 0755)

	if _, err := os.Stat(config.CSSExtraction.FontAwesome.FontOutput); err == nil {
		fmt.Printf("✓ Font already exists: %s\n", config.CSSExtraction.FontAwesome.FontOutput)
		return config.CSSExtraction.FontAwesome.FontOutput
	}

	fmt.Println("📦 Downloading Font Awesome font...")

	resp, err := http.Get(config.CSSExtraction.FontAwesome.FontURL)
	if err != nil {
		fmt.Printf("Error downloading font: %v\n", err)
		return ""
	}
	defer resp.Body.Close()

	file, err := os.Create(config.CSSExtraction.FontAwesome.FontOutput)
	if err != nil {
		fmt.Printf("Error creating font file: %v\n", err)
		return ""
	}
	defer file.Close()

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		fmt.Printf("Error downloading font: %v\n", err)
		return ""
	}

	if stat, err := os.Stat(config.CSSExtraction.FontAwesome.FontOutput); err == nil {
		fmt.Printf("✓ Downloaded font: %s (%d bytes)\n", config.CSSExtraction.FontAwesome.FontOutput, stat.Size())
		return config.CSSExtraction.FontAwesome.FontOutput
	}

	return ""
}

func saveCache(cache ExtractionCache) {
	data, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(config.CSSExtraction.CacheFile, data, 0644)
}

func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f%c", float64(bytes)/float64(div), "KMGTPE"[exp])
}