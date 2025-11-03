package config

import "testing"

func TestNewTestOptionsConfig(t *testing.T) {
	// Test default values
	options := NewTestOptionsConfig()

	if options.Core.MaxContentLength != 10000 {
		t.Errorf("Expected MaxContentLength 10000, got %d", options.Core.MaxContentLength)
	}
	if options.Features.FileUpload.MaxFileSizeMB != 5 {
		t.Errorf("Expected MaxFileSizeMB 5, got %d", options.Features.FileUpload.MaxFileSizeMB)
	}
	if options.Features.FileUpload.MaxFilesPerPost != 25 {
		t.Errorf("Expected MaxFilesPerPost 25, got %d", options.Features.FileUpload.MaxFilesPerPost)
	}
	if !options.Features.FileUpload.Enabled {
		t.Error("Expected FileUpload to be enabled by default")
	}
	if !options.Features.Activity.Enabled {
		t.Error("Expected Activity to be enabled by default")
	}
	if !options.Features.DetailedStats.Enabled {
		t.Error("Expected DetailedStats to be enabled by default")
	}
	if options.Features.RetroactivePosting.Enabled {
		t.Error("Expected RetroactivePosting to be disabled by default")
	}
	if options.Features.Markdown.Enabled {
		t.Error("Expected Markdown to be disabled by default")
	}
}

func TestOptionsConfigChaining(t *testing.T) {
	// Test chaining methods
	options := NewTestOptionsConfig().
		WithMaxContentLength(1000).
		WithMaxFileSizeMB(10).
		WithMaxFilesPerPost(5).
		WithActivityEnabled(false).
		WithRetroactivePostingEnabled(true).
		WithMarkdownEnabled(false).
		WithFileUploadEnabled(false)

	if options.Core.MaxContentLength != 1000 {
		t.Errorf("Expected MaxContentLength 1000, got %d", options.Core.MaxContentLength)
	}
	if options.Features.FileUpload.MaxFileSizeMB != 10 {
		t.Errorf("Expected MaxFileSizeMB 10, got %d", options.Features.FileUpload.MaxFileSizeMB)
	}
	if options.Features.FileUpload.MaxFilesPerPost != 5 {
		t.Errorf("Expected MaxFilesPerPost 5, got %d", options.Features.FileUpload.MaxFilesPerPost)
	}
	if options.Features.FileUpload.Enabled {
		t.Error("Expected FileUpload to be disabled")
	}
	if options.Features.Activity.Enabled {
		t.Error("Expected Activity to be disabled")
	}
	if !options.Features.RetroactivePosting.Enabled {
		t.Error("Expected RetroactivePosting to be enabled")
	}
	if options.Features.Markdown.Enabled {
		t.Error("Expected Markdown to be disabled")
	}
}
