//go:build production
// +build production

package embedded

import (
	"embed"
	"io/fs"
	"sync"
)

var (
	prodBundleFS embed.FS
	prodConfigJSON []byte
	onceBundleFS   sync.Once
	onceConfigJSON sync.Once
)

// SetBundleFS sets the embedded bundle filesystem (called from main)
func SetBundleFS(fs embed.FS) {
	onceBundleFS.Do(func() {
		prodBundleFS = fs
	})
}

// SetConfigJSON sets the embedded config JSON (called from main)
func SetConfigJSON(data []byte) {
	onceConfigJSON.Do(func() {
		prodConfigJSON = data
	})
}

// GetBundleFS returns the embedded bundle filesystem
func GetBundleFS() (fs.FS, error) {
	return fs.Sub(prodBundleFS, "bundle")
}

// GetConfigJSON returns the embedded config JSON
func GetConfigJSON() []byte {
	return prodConfigJSON
}

// IsEmbedded returns true when assets are embedded
func IsEmbedded() bool {
	return true
}
