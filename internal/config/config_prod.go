//go:build production
// +build production

package config

import "backthynk/internal/embedded"

func getEmbeddedConfig() []byte {
	return embedded.GetConfigJSON()
}
