package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type ServiceConfig struct {
	Server struct {
		Port string `json:"port"`
	} `json:"server"`
	Files struct {
		ConfigFilename   string `json:"configFilename"`
		DatabaseFilename string `json:"databaseFilename"`
		UploadsSubdir    string `json:"uploadsSubdir"`
		StoragePath      string `json:"storagePath"`
	} `json:"files"`
}

var serviceConfig *ServiceConfig

func LoadServiceConfig() error {
	data, err := os.ReadFile("service.json")
	if err != nil {
		return fmt.Errorf("failed to read service.json: %w", err)
	}

	var config ServiceConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse service.json: %w", err)
	}

	// Validate required fields
	if config.Server.Port == "" {
		return fmt.Errorf("server.port is required in service.json")
	}
	if config.Files.ConfigFilename == "" {
		return fmt.Errorf("files.configFilename is required in service.json")
	}
	if config.Files.DatabaseFilename == "" {
		return fmt.Errorf("files.databaseFilename is required in service.json")
	}
	if config.Files.UploadsSubdir == "" {
		return fmt.Errorf("files.uploadsSubdir is required in service.json")
	}
	if config.Files.StoragePath == "" {
		return fmt.Errorf("files.storagePath is required in service.json")
	}

	serviceConfig = &config
	return nil
}

func GetServiceConfig() *ServiceConfig {
	if serviceConfig == nil {
		panic("service configuration not loaded - call LoadServiceConfig() first")
	}
	return serviceConfig
}
