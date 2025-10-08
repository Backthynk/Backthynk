//go:build production
// +build production

package config

import "backthynk/internal/embedded"

func getEmbeddedConfig() []byte {
	return embedded.GetConfigJSON()
}

// GetAppMode returns the app mode for production builds
// In production builds, always return production mode
func GetAppMode() string {
	return APP_MODE_PROD
}
