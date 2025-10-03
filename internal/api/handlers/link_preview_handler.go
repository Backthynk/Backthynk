package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/logger"
	"backthynk/internal/core/services"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"go.uber.org/zap"
	"golang.org/x/net/html"
)

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

type LinkPreviewHandler struct {
	fileService *services.FileService
}

func NewLinkPreviewHandler(fileService *services.FileService) *LinkPreviewHandler {
	return &LinkPreviewHandler{
		fileService: fileService,
	}
}

func FetchLinkPreview(w http.ResponseWriter, r *http.Request) {
	var req LinkPreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, config.ErrInvalidRequestBody, http.StatusBadRequest)
		return
	}

	if _, err := url.ParseRequestURI(req.URL); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(LinkPreviewResponse{
			URL:   req.URL,
			Error: config.ErrInvalidURL,
		})
		return
	}
	
	metadata, err := extractMetadata(req.URL)
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

func (h *LinkPreviewHandler) GetLinkPreviewsByPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidPostID, http.StatusBadRequest)
		return
	}

	post, err := h.fileService.GetPostWithAttachments(postID)
	if err != nil {
		http.Error(w, config.ErrPostNotFound, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post.LinkPreviews)
}

func extractMetadata(urlStr string) (*LinkPreviewResponse, error) {
	client := &http.Client{
		Timeout: config.LinkPreviewHTTPTimeout,
	}

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		logger.Error("Failed to create link preview request", zap.String("url", urlStr), zap.Error(err))
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)")

	resp, err := client.Do(req)
	if err != nil {
		logger.Error("Failed to fetch URL for link preview", zap.String("url", urlStr), zap.Error(err))
		return nil, fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(contentType, "text/html") {
		logger.Warning("URL is not HTML content", zap.String("url", urlStr), zap.String("content_type", contentType))
		return nil, fmt.Errorf(config.ErrURLNotHTML)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Error("Failed to read response body for link preview", zap.String("url", urlStr), zap.Error(err))
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	doc, err := html.Parse(strings.NewReader(string(body)))
	if err != nil {
		logger.Error("Failed to parse HTML for link preview", zap.String("url", urlStr), zap.Error(err))
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}
	
	metadata := &LinkPreviewResponse{
		URL: urlStr,
	}
	
	extractMetaTags(doc, metadata)
	
	if metadata.Title == "" {
		metadata.Title = extractTitle(doc)
	}
	
	metadata.Title = strings.TrimSpace(metadata.Title)
	metadata.Description = strings.TrimSpace(metadata.Description)
	metadata.SiteName = strings.TrimSpace(metadata.SiteName)
	
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

func extractMetaTags(n *html.Node, metadata *LinkPreviewResponse) {
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
		case "description":
			if metadata.Description == "" {
				metadata.Description = content
			}
		}
	}
	
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		extractMetaTags(c, metadata)
	}
}

func extractTitle(n *html.Node) string {
	if n.Type == html.ElementNode && n.Data == "title" {
		if n.FirstChild != nil && n.FirstChild.Type == html.TextNode {
			return n.FirstChild.Data
		}
	}
	
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if title := extractTitle(c); title != "" {
			return title
		}
	}
	
	return ""
}