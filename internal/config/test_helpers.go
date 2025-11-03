package config

// NewTestOptionsConfig creates a default OptionsConfig for testing.
// You can override specific values by modifying the returned config.
func NewTestOptionsConfig() *OptionsConfig {
	return &OptionsConfig{
		Core: struct {
			MaxContentLength int `json:"maxContentLength"`
		}{
			MaxContentLength: 10000,
		},
		Features: struct {
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
			Markdown struct {
				Enabled bool `json:"enabled"`
			} `json:"markdown"`
			FileUpload struct {
				Enabled           bool     `json:"enabled"`
				MaxFileSizeMB     int      `json:"maxFileSizeMB"`
				MaxFilesPerPost   int      `json:"maxFilesPerPost"`
				AllowedExtensions []string `json:"allowedExtensions"`
			} `json:"fileUpload"`
			Preview struct {
				Enabled          bool     `json:"enabled"`
				SupportedFormats []string `json:"supportedFormats"`
				JpegQuality      int      `json:"jpegQuality"`
				Sizes            struct {
					Large  int `json:"large"`
					Medium int `json:"medium"`
					Small  int `json:"small"`
				} `json:"sizes"`
			} `json:"preview"`
		}{
			Activity: struct {
				Enabled      bool `json:"enabled"`
			}{
				Enabled:      true,
			},
			DetailedStats: struct {
				Enabled bool `json:"enabled"`
			}{
				Enabled: true,
			},
			RetroactivePosting: struct {
				Enabled    bool   `json:"enabled"`
				TimeFormat string `json:"timeFormat"`
			}{
				Enabled:    false,
				TimeFormat: "24h",
			},
			Markdown: struct {
				Enabled bool `json:"enabled"`
			}{
				Enabled: false,
			},
			FileUpload: struct {
				Enabled           bool     `json:"enabled"`
				MaxFileSizeMB     int      `json:"maxFileSizeMB"`
				MaxFilesPerPost   int      `json:"maxFilesPerPost"`
				AllowedExtensions []string `json:"allowedExtensions"`
			}{
				Enabled:           true,
				MaxFileSizeMB:     5,
				MaxFilesPerPost:   25,
				AllowedExtensions: []string{"jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx", "xls", "xlsx", "txt", "zip", "mp4", "mov", "avi"},
			},
			Preview: struct {
				Enabled          bool     `json:"enabled"`
				SupportedFormats []string `json:"supportedFormats"`
				JpegQuality      int      `json:"jpegQuality"`
				Sizes            struct {
					Large  int `json:"large"`
					Medium int `json:"medium"`
					Small  int `json:"small"`
				} `json:"sizes"`
			}{
				Enabled:          true,
				SupportedFormats: []string{"jpg", "jpeg", "png", "gif", "webp"},
				JpegQuality:      85,
				Sizes: struct {
					Large  int `json:"large"`
					Medium int `json:"medium"`
					Small  int `json:"small"`
				}{
					Large:  600,
					Medium: 300,
					Small:  150,
				},
			},
		},
	}
}

// WithMaxContentLength sets the MaxContentLength for tests
func (o *OptionsConfig) WithMaxContentLength(val int) *OptionsConfig {
	o.Core.MaxContentLength = val
	return o
}

// WithMaxFileSizeMB sets the MaxFileSizeMB for tests
func (o *OptionsConfig) WithMaxFileSizeMB(val int) *OptionsConfig {
	o.Features.FileUpload.MaxFileSizeMB = val
	return o
}

// WithMaxFilesPerPost sets the MaxFilesPerPost for tests
func (o *OptionsConfig) WithMaxFilesPerPost(val int) *OptionsConfig {
	o.Features.FileUpload.MaxFilesPerPost = val
	return o
}

// WithFileUploadEnabled sets the FileUpload.Enabled feature for tests
func (o *OptionsConfig) WithFileUploadEnabled(enabled bool) *OptionsConfig {
	o.Features.FileUpload.Enabled = enabled
	return o
}

// WithAllowedExtensions sets the FileUpload.AllowedExtensions for tests
func (o *OptionsConfig) WithAllowedExtensions(extensions []string) *OptionsConfig {
	o.Features.FileUpload.AllowedExtensions = extensions
	return o
}

// WithActivityEnabled sets the Activity.Enabled feature for tests
func (o *OptionsConfig) WithActivityEnabled(enabled bool) *OptionsConfig {
	o.Features.Activity.Enabled = enabled
	return o
}

// WithDetailedStatsEnabled sets the DetailedStats.Enabled feature for tests
func (o *OptionsConfig) WithDetailedStatsEnabled(enabled bool) *OptionsConfig {
	o.Features.DetailedStats.Enabled = enabled
	return o
}

// WithRetroactivePostingEnabled sets the RetroactivePosting.Enabled feature for tests
func (o *OptionsConfig) WithRetroactivePostingEnabled(enabled bool) *OptionsConfig {
	o.Features.RetroactivePosting.Enabled = enabled
	return o
}

// WithRetroactivePostingTimeFormat sets the RetroactivePosting.TimeFormat for tests
func (o *OptionsConfig) WithRetroactivePostingTimeFormat(format string) *OptionsConfig {
	o.Features.RetroactivePosting.TimeFormat = format
	return o
}

// WithMarkdownEnabled sets the Markdown.Enabled feature for tests
func (o *OptionsConfig) WithMarkdownEnabled(enabled bool) *OptionsConfig {
	o.Features.Markdown.Enabled = enabled
	return o
}
