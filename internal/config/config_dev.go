//go:build !production
// +build !production

package config

import "os"

func getEmbeddedConfig() []byte {
	return nil
}

// GetAppMode returns the app mode for development builds
// In dev builds, check the APP_ENV environment variable
func GetAppMode() string {
	mode := os.Getenv("APP_ENV")

	switch mode {
	case "pre-production":
		return APP_MODE_PRE_PROD
	case "production":
		return APP_MODE_PROD
	default:
		return APP_MODE_DEV
	}
}
