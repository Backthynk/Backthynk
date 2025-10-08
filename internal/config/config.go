package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const (
	APP_MODE_DEV        = "development"   //back-end && front-end in dev mode
	APP_MODE_PRE_PROD   = "pre-production" //front-end used is the built one && back-end in dev-mode
	APP_MODE_PROD  = "production"     //one binary with everything integrated in.
)

const (
	VERSION = "0.1.0"

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

type SharedConfig struct {
	App struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	} `json:"app"`
	Paths struct {
		BuildDir     string `json:"build_dir"`
		Dir struct {
			Development string `json:"development"`
			PreProduction string `json:"pre-production"`
		} `json:"dir"`
		Source struct {
			Static    string `json:"static"`
			Templates string `json:"templates"`
			JS        string `json:"js"`
			CSS       string `json:"css"`
		} `json:"source"`
	} `json:"paths"`
	URLs struct {
		CDN         map[string]interface{} `json:"cdn"`
		GithubURL   string                 `json:"github_url"`
		NewIssueURL string                 `json:"new_issue_url"`
	} `json:"urls"`
}

var (
	serviceConfig *ServiceConfig
	optionsConfig *OptionsConfig
	sharedConfig  *SharedConfig
)

func LoadSharedConfig() error {
	var data []byte
	var err error

	// In production mode, use embedded config if available
	if GetAppMode() == APP_MODE_PROD {
		data = getEmbeddedConfig()
		if len(data) == 0 {
			return fmt.Errorf("embedded config not available in production mode")
		}
	} else {
		// In dev/pre-prod mode, read from file system
		configPath := GetConfigJSONPath()
		data, err = os.ReadFile(configPath)
		if err != nil {
			return fmt.Errorf("failed to read shared config from %s: %w", configPath, err)
		}
	}

	var config SharedConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse shared config: %w", err)
	}

	sharedConfig = &config
	return nil
}

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
	//06/10/2025
	//Force disable markdown
	optionsConfig.WithMarkdownEnabled(false)
	return nil
}

func GetServiceConfig() *ServiceConfig {
	return serviceConfig
}

func GetOptionsConfig() *OptionsConfig {
	return optionsConfig
}

func GetSharedConfig() *SharedConfig {
	return sharedConfig
}

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

func (sc *SharedConfig) GetRessourcesRootPath() string {
	if sc == nil {
		return ""
	}
	if GetAppMode() == APP_MODE_PRE_PROD {
		return sc.Paths.Dir.PreProduction
	}
	return sc.Paths.Dir.Development
}

func (sc *SharedConfig) GetWebStaticPath() string {
	return filepath.Join(sc.GetRessourcesRootPath(), sc.Paths.Source.Static)
}

func (sc *SharedConfig) GetWebTemplatesPath() string {
	return filepath.Join(sc.GetRessourcesRootPath(), sc.Paths.Source.Templates)
}	

func (sc *SharedConfig) GetWebJSPath() string {
	return filepath.Join(sc.GetRessourcesRootPath(), sc.Paths.Source.JS)
}

func (sc *SharedConfig) GetWebCSSPath() string {
	return filepath.Join(sc.GetRessourcesRootPath(), sc.Paths.Source.CSS)
}

func GetConfigJSONPath() string {
	configPath := ".config.json"
	if _, err := os.Stat("scripts/common"); err == nil {
		configPath = "scripts/.config.json"
	}
	sharedConfigPath, _ := filepath.Abs(configPath)
	return sharedConfigPath
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

	if mode != APP_MODE_PROD {
		// Shared config
		configPath := GetConfigJSONPath()
		fmt.Printf("  %s└─%s .config.json\n", colorCyan, colorReset)
		fmt.Printf("    %s%s%s\n\n", colorYellow, configPath, colorReset)
		// Web resources
		fmt.Printf("%s%sWeb Resources:%s\n", colorBold, colorPurple, colorReset)

		if sharedConfig != nil {
			absWebPath, _ := filepath.Abs(sharedConfig.GetRessourcesRootPath())
			fmt.Printf("  %s└─%s %s\n", colorCyan, colorReset, mode)
			fmt.Printf("    %s%s%s\n", colorYellow, absWebPath, colorReset)
		}
	}



}