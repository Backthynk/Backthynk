//go:build !production
// +build !production

package config

func getEmbeddedConfig() []byte {
	return nil
}
