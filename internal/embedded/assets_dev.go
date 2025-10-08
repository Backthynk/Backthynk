//go:build !production
// +build !production

package embedded

import (
	"embed"
	"io/fs"
	"os"
)

// SetBundleFS is a no-op in development mode
func SetBundleFS(fs embed.FS) {
	// No-op: not used in development
}

// GetBundleFS returns nil in development mode (use filesystem)
func GetBundleFS() (fs.FS, error) {
	return os.DirFS("bundle"), nil
}

// IsEmbedded returns false in development mode
func IsEmbedded() bool {
	return false
}
