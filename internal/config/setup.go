package config

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// EnsureConfigFiles checks if service.json and options.json exist,
// and creates them interactively if they don't
func EnsureConfigFiles() error {
	needsServiceConfig := false
	needsOptionsConfig := false

	// Check service.json
	if _, err := os.Stat("service.json"); os.IsNotExist(err) {
		needsServiceConfig = true
	}

	// Check options.json
	if _, err := os.Stat("options.json"); os.IsNotExist(err) {
		needsOptionsConfig = true
	}

	if !needsServiceConfig && !needsOptionsConfig {
		return nil
	}

	// Show setup header
	fmt.Printf("\n%s%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n", colorBold, colorCyan, colorReset)
	fmt.Printf("%s%s  BackThynk Initial Setup%s\n", colorBold, colorCyan, colorReset)
	fmt.Printf("%s%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n\n", colorBold, colorCyan, colorReset)

	reader := bufio.NewReader(os.Stdin)

	if needsServiceConfig {
		if err := createServiceConfig(reader); err != nil {
			return fmt.Errorf("failed to create service.json: %w", err)
		}
	}

	if needsOptionsConfig {
		if err := createOptionsConfig(); err != nil {
			return fmt.Errorf("failed to create options.json: %w", err)
		}
	}

	fmt.Printf("\n%s%s✓ Configuration completed successfully!%s\n\n", colorBold, colorGreen, colorReset)

	return nil
}

func createServiceConfig(reader *bufio.Reader) error {
	fmt.Printf("%s%sService Configuration%s\n", colorBold, colorBlue, colorReset)
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	// Get storage path
	storagePath := promptStoragePath(reader)

	// Get port
	port := promptPort(reader)

	// Create service config
	config := ServiceConfig{}
	config.Server.Port = port
	config.Files.ConfigFilename = "options.json"
	config.Files.DatabaseFilename = "app.db"
	config.Files.UploadsSubdir = "uploads"
	config.Files.StoragePath = storagePath
	config.Logging.DisplayLogs = false
	config.Logging.EnableRequestLogs = true

	// Save to file
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile("service.json", data, FilePermissions); err != nil {
		return err
	}

	fmt.Printf("%s✓ Created service.json%s\n\n", colorGreen, colorReset)
	return nil
}

func createOptionsConfig() error {
	// Read the existing options.json from project root as template
	data, err := os.ReadFile("options.json")
	if err != nil {
		// If it doesn't exist, create a default one
		defaultConfig := OptionsConfig{
			Core: struct {
				MaxContentLength int `json:"maxContentLength"`
			}{
				MaxContentLength: 1500,
			},
			Metadata: struct {
				Title       string `json:"title"`
				Description string `json:"description"`
			}{
				Title:       "Backthynk",
				Description: "Self-hosted micro-blogging platform for people with messy thoughts.",
			},
		}

		// Initialize features
		defaultConfig.Features.Activity.Enabled = true
		defaultConfig.Features.Activity.PeriodMonths = 4
		defaultConfig.Features.DetailedStats.Enabled = true
		defaultConfig.Features.RetroactivePosting.Enabled = false
		defaultConfig.Features.RetroactivePosting.TimeFormat = "24h"
		defaultConfig.Features.FileUpload.Enabled = true
		defaultConfig.Features.FileUpload.MaxFileSizeMB = 100
		defaultConfig.Features.FileUpload.MaxFilesPerPost = 25
		defaultConfig.Features.FileUpload.AllowedExtensions = []string{
			"jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx",
			"xls", "xlsx", "txt", "zip", "mp4", "mov", "avi", "rar",
			"7z", "mp3", "wav", "ogg", "flac", "m4a", "json", "csv",
			"yaml", "yml", "md", "xml", "ppt", "pptx", "odt", "ods", "odp",
		}

		data, err = json.MarshalIndent(defaultConfig, "", "  ")
		if err != nil {
			return err
		}
	}

	// Write options.json (no interactive prompt needed, just copy from existing)
	if err := os.WriteFile("options.json", data, FilePermissions); err != nil {
		return err
	}

	fmt.Printf("%s✓ Created options.json%s\n", colorGreen, colorReset)
	return nil
}

func promptStoragePath(reader *bufio.Reader) string {
	fmt.Printf("%sStorage Path%s\n", colorYellow, colorReset)
	fmt.Printf("This is where BackThynk will store its database and uploaded files.\n")
	fmt.Printf("Press Tab for autocomplete, or Enter for default (.storage)\n\n")

	for {
		fmt.Printf("%s> %s", colorCyan, colorReset)
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		// Default value
		if input == "" {
			input = ".storage"
		}

		// Expand ~ to home directory
		if strings.HasPrefix(input, "~") {
			home, err := os.UserHomeDir()
			if err == nil {
				input = filepath.Join(home, input[1:])
			}
		}

		// Clean the path
		input = filepath.Clean(input)

		// Validate path
		if input == "" {
			fmt.Printf("%s✗ Path cannot be empty%s\n\n", colorRed, colorReset)
			continue
		}

		// Check if parent directory exists or can be created
		parentDir := filepath.Dir(input)
		if parentDir != "." {
			if _, err := os.Stat(parentDir); os.IsNotExist(err) {
				fmt.Printf("%s! Parent directory %s doesn't exist. Create it? (y/n): %s", colorYellow, parentDir, colorReset)
				confirm, _ := reader.ReadString('\n')
				confirm = strings.TrimSpace(strings.ToLower(confirm))
				if confirm == "y" || confirm == "yes" {
					if err := os.MkdirAll(parentDir, DirectoryPermissions); err != nil {
						fmt.Printf("%s✗ Failed to create parent directory: %v%s\n\n", colorRed, err, colorReset)
						continue
					}
				} else {
					continue
				}
			}
		}

		fmt.Printf("%s✓ Using storage path: %s%s\n\n", colorGreen, input, colorReset)
		return input
	}
}

func promptPort(reader *bufio.Reader) string {
	fmt.Printf("%sServer Port%s\n", colorYellow, colorReset)
	fmt.Printf("Choose a port for the BackThynk server (1024-65535)\n")
	fmt.Printf("Press Enter for default (1369)\n\n")

	for {
		fmt.Printf("%s> %s", colorCyan, colorReset)
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		// Default value
		if input == "" {
			input = "1369"
		}

		// Parse port
		port, err := strconv.Atoi(input)
		if err != nil {
			fmt.Printf("%s✗ Invalid port number%s\n\n", colorRed, colorReset)
			continue
		}

		// Validate port range
		if port < 1024 || port > 65535 {
			fmt.Printf("%s✗ Port must be between 1024 and 65535%s\n\n", colorRed, colorReset)
			continue
		}

		// Check if port is available
		if !isPortAvailable(port) {
			fmt.Printf("%s✗ Port %d is already in use%s\n\n", colorRed, port, colorReset)
			continue
		}

		fmt.Printf("%s✓ Using port: %d%s\n\n", colorGreen, port, colorReset)
		return input
	}
}

func isPortAvailable(port int) bool {
	address := fmt.Sprintf(":%d", port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return false
	}
	listener.Close()
	return true
}

// PrintStartupInfo displays a clean startup summary with enabled features, port, and RAM usage
func PrintStartupInfo(port string, opts *OptionsConfig) {
	fmt.Printf("\n%s%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n", colorBold, colorCyan, colorReset)
	fmt.Printf("%s%s  BackThynk Server Started%s\n", colorBold, colorCyan, colorReset)
	fmt.Printf("%s%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n\n", colorBold, colorCyan, colorReset)

	// Server info
	fmt.Printf("%s%sServer:%s http://localhost:%s\n", colorBold, colorBlue, colorReset, port)

	// RAM usage
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	ramMB := float64(m.Alloc) / 1024 / 1024
	fmt.Printf("%s%sMemory:%s %.2f MB\n\n", colorBold, colorBlue, colorReset, ramMB)

	// Enabled features
	fmt.Printf("%s%sEnabled Features:%s\n", colorBold, colorBlue, colorReset)

	features := []struct {
		name    string
		enabled bool
	}{
		{"Activity Tracking", opts.Features.Activity.Enabled},
		{"Detailed Statistics", opts.Features.DetailedStats.Enabled},
		{"Retroactive Posting", opts.Features.RetroactivePosting.Enabled},
		{"File Uploads", opts.Features.FileUpload.Enabled},
	}

	for _, f := range features {
		status := colorRed + "✗"
		if f.enabled {
			status = colorGreen + "✓"
		}
		fmt.Printf("  %s%s %s%s\n", status, colorReset, f.name, colorReset)
	}

	fmt.Printf("\n%s%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n\n", colorBold, colorCyan, colorReset)
}
