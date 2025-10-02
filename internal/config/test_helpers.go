package config

// NewTestOptionsConfig creates a default OptionsConfig for testing.
// You can override specific values by modifying the returned config.
func NewTestOptionsConfig() *OptionsConfig {
	return &OptionsConfig{
		Core: struct {
			MaxContentLength int `json:"maxContentLength"`
			MaxFileSizeMB    int `json:"maxFileSizeMB"`
			MaxFilesPerPost  int `json:"maxFilesPerPost"`
		}{
			MaxContentLength: 10000,
			MaxFileSizeMB:    5,
			MaxFilesPerPost:  25,
		},
		Features: struct {
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
		}{
			Activity: struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			}{
				Enabled:      true,
				PeriodMonths: 4,
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
	o.Core.MaxFileSizeMB = val
	return o
}

// WithMaxFilesPerPost sets the MaxFilesPerPost for tests
func (o *OptionsConfig) WithMaxFilesPerPost(val int) *OptionsConfig {
	o.Core.MaxFilesPerPost = val
	return o
}

// WithActivityEnabled sets the Activity.Enabled feature for tests
func (o *OptionsConfig) WithActivityEnabled(enabled bool) *OptionsConfig {
	o.Features.Activity.Enabled = enabled
	return o
}

// WithActivityPeriodMonths sets the Activity.PeriodMonths feature for tests
func (o *OptionsConfig) WithActivityPeriodMonths(months int) *OptionsConfig {
	o.Features.Activity.PeriodMonths = months
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
