package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const VERSION = "0.2.0"

const (
	APP_MODE_DEV        = "development"   //back-end && front-end in dev mode
	APP_MODE_PRE_PROD   = "pre-production" //front-end used is the built one && back-end in dev-mode
	APP_MODE_PROD  = "production"     //one binary with everything integrated in.
)

const (
	// Space Limits
	MaxSpaceDepth             = 2
	MaxSpaceNameLength        = 30
	MaxSpaceDescriptionLength = 280

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

	// Patterns (updated to allow more flexible display names)
	// Must start AND end with letter or number, then allow letters, numbers, spaces, hyphens, underscores, apostrophes, and periods in between
	SpaceNamePattern = `^[a-zA-Z0-9]([a-zA-Z0-9\s\-_'.])*[a-zA-Z0-9]$|^[a-zA-Z0-9]$`

	// Route Names
	RouteAPI      = "api"
	RouteStatic   = "static"
	RouteUploads  = "uploads"
	RouteSettings = "settings"

	// Logging
	MaxLogFileSizeKB = 1024 // 1MB
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
	Logging struct {
		DisplayLogs       bool `json:"displayLogs"`
		EnableRequestLogs bool `json:"enableRequestLogs"`
	} `json:"logging"`
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
		} `json:"activity"`
		DetailedStats struct {
			Enabled bool `json:"enabled"`
		} `json:"detailedStats"`
		RetroactivePosting struct {
			Enabled    bool   `json:"enabled"`
			TimeFormat string `json:"timeFormat"`
		} `json:"retroactivePosting"`
		FileUpload struct {
			Enabled           bool     `json:"enabled"`
			MaxFileSizeMB     int      `json:"maxFileSizeMB"`
			MaxFilesPerPost   int      `json:"maxFilesPerPost"`
			AllowedExtensions []string `json:"allowedExtensions"`
		} `json:"fileUpload"`
		Preview struct {
			Enabled            bool     `json:"enabled"`
			SupportedFormats   []string `json:"supportedFormats"`
			JpegQuality        int      `json:"jpegQuality"`
			Sizes              struct {
				Large  int `json:"large"`
				Medium int `json:"medium"`
				Small  int `json:"small"`
			} `json:"sizes"`
		} `json:"preview"`
	} `json:"features"`
}

func (o *OptionsConfig) ToClientFormat() map[string]interface{} {
	//only features
	features := make(map[string]interface{})
	features["core"] = map[string]interface{}{
		"max_content_length": o.Core.MaxContentLength,
	}

	if o.Features.Activity.Enabled{
		features["activity"] = o.Features.Activity.Enabled
	}
	if o.Features.DetailedStats.Enabled{
		features["space_stats"] = o.Features.DetailedStats.Enabled
	}
	if o.Features.RetroactivePosting.Enabled {
		features["retroactive_posting"] = map[string]interface{}{
			"time_format": o.Features.RetroactivePosting.TimeFormat,
		}
	}
	if o.Features.FileUpload.Enabled {
		features["file_upload"] = map[string]interface{}{
			"max_file_size_mb":     o.Features.FileUpload.MaxFileSizeMB,
			"max_files_per_post":   o.Features.FileUpload.MaxFilesPerPost,
			"allowed_extensions":   o.Features.FileUpload.AllowedExtensions,
		}
	}
	if o.Features.Preview.Enabled {
		features["preview"] = map[string]interface{}{
			"supported_formats": o.Features.Preview.SupportedFormats,
		}
	}
	
	return features
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

// SetServiceConfigForTest sets the service config for testing purposes
func SetServiceConfigForTest(config *ServiceConfig) {
	serviceConfig = config
}

// SetOptionsConfigForTest sets the options config for testing purposes
func SetOptionsConfigForTest(config *OptionsConfig) {
	optionsConfig = config
}


// ANSI color codes
const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorPurple = "\033[35m"
	colorCyan   = "\033[36m"
	colorBold   = "\033[1m"
)

// PrintConfigPaths prints the configuration file paths with colors
func PrintConfigPaths() {
	mode := GetAppMode()
	modeColor := colorGreen
	if mode == APP_MODE_PROD {
		modeColor = colorYellow
	}

	fmt.Printf("\n%s%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n", colorBold, colorCyan, colorReset)
	fmt.Printf("%s%s  Configuration Files%s\n", colorBold, colorCyan, colorReset)
	fmt.Printf("%s%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n\n", colorBold, colorCyan, colorReset)

	fmt.Printf("%s%sMode:%s %s%s%s\n\n", colorBold, colorBlue, colorReset, modeColor, mode, colorReset)

	// Backend configs
	fmt.Printf("%s%sBackend Configuration:%s\n", colorBold, colorPurple, colorReset)

	// Service config
	serviceConfigPath, _ := filepath.Abs("service.json")
	fmt.Printf("  %s├─%s service.json\n", colorCyan, colorReset)
	fmt.Printf("  %s│%s  %s%s%s\n", colorCyan, colorReset, colorYellow, serviceConfigPath, colorReset)

	// Options config
	if serviceConfig != nil {
		optionsConfigPath, _ := filepath.Abs(serviceConfig.Files.ConfigFilename)
		fmt.Printf("  %s├─%s options.json\n", colorCyan, colorReset)
		fmt.Printf("  %s│%s  %s%s%s\n", colorCyan, colorReset, colorYellow, optionsConfigPath, colorReset)
	}
}