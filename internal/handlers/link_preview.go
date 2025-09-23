package handlers

import (
	"backthynk/internal/storage"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"golang.org/x/net/html"
)

type LinkPreviewHandler struct {
	db *storage.DB
}

func NewLinkPreviewHandler(db *storage.DB) *LinkPreviewHandler {
	return &LinkPreviewHandler{db: db}
}

type LinkPreviewRequest struct {
	URL string `json:"url"`
}

type LinkPreviewResponse struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url"`
	SiteName    string `json:"site_name"`
	Error       string `json:"error,omitempty"`
}

// FetchLinkPreview extracts metadata from a URL
func (h *LinkPreviewHandler) FetchLinkPreview(w http.ResponseWriter, r *http.Request) {
	var req LinkPreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate URL
	if _, err := url.ParseRequestURI(req.URL); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(LinkPreviewResponse{
			URL:   req.URL,
			Error: "Invalid URL",
		})
		return
	}

	// Fetch metadata
	metadata, err := h.extractMetadata(req.URL)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(LinkPreviewResponse{
			URL:   req.URL,
			Error: err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(*metadata)
}

// GetLinkPreviewsByPost retrieves all link previews for a specific post
func (h *LinkPreviewHandler) GetLinkPreviewsByPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	previews, err := h.db.GetLinkPreviewsByPostID(postID)
	if err != nil {
		http.Error(w, "Failed to fetch link previews", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(previews)
}

func (h *LinkPreviewHandler) extractMetadata(urlStr string) (*LinkPreviewResponse, error) {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Create request with user agent
	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)")

	// Make request
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(contentType, "text/html") {
		return nil, fmt.Errorf("URL does not return HTML content")
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse HTML
	doc, err := html.Parse(strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Extract metadata
	metadata := &LinkPreviewResponse{
		URL: urlStr,
	}

	h.extractMetaTags(doc, metadata)

	// Fallback to basic HTML tags if meta tags are missing
	if metadata.Title == "" {
		metadata.Title = h.extractTitle(doc)
	}

	// Clean up data
	metadata.Title = strings.TrimSpace(metadata.Title)
	metadata.Description = strings.TrimSpace(metadata.Description)
	metadata.SiteName = strings.TrimSpace(metadata.SiteName)

	// Set default title if still empty
	if metadata.Title == "" {
		metadata.Title = urlStr
	}

	// Resolve relative URLs
	if metadata.ImageURL != "" {
		if absURL, err := url.Parse(metadata.ImageURL); err == nil {
			if !absURL.IsAbs() {
				if baseURL, err := url.Parse(urlStr); err == nil {
					metadata.ImageURL = baseURL.ResolveReference(absURL).String()
				}
			}
		}
	}

	return metadata, nil
}

func (h *LinkPreviewHandler) extractMetaTags(n *html.Node, metadata *LinkPreviewResponse) {
	if n.Type == html.ElementNode && n.Data == "meta" {
		var name, property, content string

		for _, attr := range n.Attr {
			switch attr.Key {
			case "name":
				name = attr.Val
			case "property":
				property = attr.Val
			case "content":
				content = attr.Val
			}
		}

		// Open Graph tags
		switch property {
		case "og:title":
			metadata.Title = content
		case "og:description":
			metadata.Description = content
		case "og:image":
			metadata.ImageURL = content
		case "og:site_name":
			metadata.SiteName = content
		}

		// Twitter Card tags
		switch name {
		case "twitter:title":
			if metadata.Title == "" {
				metadata.Title = content
			}
		case "twitter:description":
			if metadata.Description == "" {
				metadata.Description = content
			}
		case "twitter:image":
			if metadata.ImageURL == "" {
				metadata.ImageURL = content
			}
		}

		// Standard meta tags
		switch name {
		case "description":
			if metadata.Description == "" {
				metadata.Description = content
			}
		}
	}

	for c := n.FirstChild; c != nil; c = c.NextSibling {
		h.extractMetaTags(c, metadata)
	}
}

func (h *LinkPreviewHandler) extractTitle(n *html.Node) string {
	if n.Type == html.ElementNode && n.Data == "title" {
		if n.FirstChild != nil && n.FirstChild.Type == html.TextNode {
			return n.FirstChild.Data
		}
	}

	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if title := h.extractTitle(c); title != "" {
			return title
		}
	}

	return ""
}

// ExtractURLsFromText extracts URLs from text content
func ExtractURLsFromText(text string) []string {
	// Regular expression to match URLs
	urlRegex := regexp.MustCompile(`https?://[^\s\)]+`)
	matches := urlRegex.FindAllString(text, -1)

	// Remove duplicates
	seen := make(map[string]bool)
	var unique []string
	for _, url := range matches {
		if !seen[url] {
			seen[url] = true
			unique = append(unique, url)
		}
	}

	return unique
}