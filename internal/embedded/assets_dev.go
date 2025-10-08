//go:build !production
// +build !production

package embedded

import (
	"io/fs"
	"os"
)

// GetBundleFS returns nil in development mode (use filesystem)
func GetBundleFS() (fs.FS, error) {
	return os.DirFS("bundle"), nil
}

// IsEmbedded returns false in development mode
func IsEmbedded() bool {
	return false
}
