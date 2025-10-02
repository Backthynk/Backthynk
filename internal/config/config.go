package config

import (
	"encoding/json"
	"os"
)

const (
	// Limits
	MaxCategoryDepth             = 2
	MaxCategoryNameLength        = 30
	MaxCategoryDescriptionLength = 280
	DefaultPostLimit             = 20
	MaxPostLimit                 = 100
	MinRetroactivePostTimestamp  = 946684800000 // 01/01/2000
	
	// Permissions
	DirectoryPermissions = 0755
	FilePermissions      = 0644
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

type OptionsConfig struct {
	Core struct {
		MaxContentLength int `json:"maxContentLength"`
		MaxFileSizeMB    int `json:"maxFileSizeMB"`
		MaxFilesPerPost  int `json:"maxFilesPerPost"`
	} `json:"core"`
	Features struct {
		Activity struct {
			Enabled      bool `json:"enabled"`
			PeriodMonths int  `json:"periodMonths"`
		} `json:"activity"`
		DetailedStats struct {
			Enabled bool `json:"enabled"`
		} `json:"detailedStats"`
		RetroactivePosting struct {
			Enabled    bool   `json:"enabled"`
			TimeFormat string `json:"timeFormat"`
		} `json:"retroactivePosting"`
	} `json:"features"`
}

var (
	serviceConfig *ServiceConfig
	optionsConfig *OptionsConfig
)

func LoadServiceConfig() error {
	data, err := os.ReadFile("service.json")
	if err != nil {
		return err
	}
	
	var config ServiceConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}
	
	serviceConfig = &config
	return nil
}

func LoadOptionsConfig() error {
	data, err := os.ReadFile("options.json")
	if err != nil {
		return err
	}
	
	var config OptionsConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}
	
	optionsConfig = &config
	return nil
}

func GetServiceConfig() *ServiceConfig {
	return serviceConfig
}

func GetOptionsConfig() *OptionsConfig {
	return optionsConfig
}

func IsProduction() bool {
	return os.Getenv("BACKTHYNK_ENV") == "production"
}

// SetServiceConfigForTest sets the service config for testing purposes
func SetServiceConfigForTest(config *ServiceConfig) {
	serviceConfig = config
}