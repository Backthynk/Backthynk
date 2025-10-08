//go:build production
// +build production

package main

import (
	"backthynk/internal/embedded"
	"embed"
)

//go:embed all:bundle
var bundleFS embed.FS

//go:embed .config.json
var configJSON []byte

func init() {
	embedded.SetBundleFS(bundleFS)
	embedded.SetConfigJSON(configJSON)
}
