package config

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

const (
	// Category Limits
	MaxCategoryDepth             = 2
	MaxCategoryNameLength        = 30
	MaxCategoryDescriptionLength = 280

	// Post Limits
	DefaultPostLimit            = 20
	MaxPostLimit                = 100
	MinRetroactivePostTimestamp = 946684800000 // 01/01/2000

	// Validation Limits
	MinFileSizeMB        = 1
	MaxFileSizeMB        = 10240
	MinContentLength     = 100
	MaxContentLength     = 50000

	/* Not quite clear but MinFilesPerPost is the minimum's maximum value
	 to set for the amount of file you can add to a post, when enabled.
	 ::-> Don't worry you don't really need to touch that.
	*/
	MinFilesPerPost      = 1 
	
	MaxFilesPerPost      = 50

	MinTitleLength       = 1 //page title
	MaxTitleLength       = 100 //page title
	MaxDescriptionLength = 160 //page description : meta

	// HTTP Timeouts
	LinkPreviewHTTPTimeout = 10 * time.Second

	// Permissions
	DirectoryPermissions = 0755
	FilePermissions      = 0644

	// Patterns
	CategoryNamePattern = `^[a-zA-Z0-9_-]+(?:\s[a-zA-Z0-9_-]+)*$`

	// Route Names
	RouteAPI      = "api"
	RouteStatic   = "static"
	RouteUploads  = "uploads"
	RouteSettings = "settings"
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
	} `json:"core"`
	Metadata struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	} `json:"metadata"`
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
		Markdown struct {
			Enabled bool `json:"enabled"`
		} `json:"markdown"`
		FileUpload struct {
			Enabled           bool     `json:"enabled"`
			MaxFileSizeMB     int      `json:"maxFileSizeMB"`
			MaxFilesPerPost   int      `json:"maxFilesPerPost"`
			AllowedExtensions []string `json:"allowedExtensions"`
		} `json:"fileUpload"`
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
	if serviceConfig == nil {
		return fmt.Errorf("service config must be loaded before options config")
	}

	data, err := os.ReadFile(serviceConfig.Files.ConfigFilename)
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

// SetOptionsConfigForTest sets the options config for testing purposes
func SetOptionsConfigForTest(config *OptionsConfig) {
	optionsConfig = config
}