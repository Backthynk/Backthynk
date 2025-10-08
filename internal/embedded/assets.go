//go:build production
// +build production

package embedded

import (
	"embed"
	"io/fs"
)

//go:embed bundle/*
var bundleFS embed.FS

// GetBundleFS returns the embedded bundle filesystem
func GetBundleFS() (fs.FS, error) {
	return fs.Sub(bundleFS, "bundle")
}

// IsEmbedded returns true when assets are embedded
func IsEmbedded() bool {
	return true
}
