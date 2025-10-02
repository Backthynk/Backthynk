# Config Test Helpers

## Overview

The `config` package provides a test helper function `NewTestOptionsConfig()` that creates a default `OptionsConfig` for testing. This centralizes the options configuration for tests, so when you update `options.json`, you only need to update the helper in one place instead of every test file.

## Usage

### Basic usage with defaults

```go
// Use default values from options.json
options := config.NewTestOptionsConfig()
```

### Customizing specific values

The function returns a pointer, so you can chain methods to override specific values:

```go
options := config.NewTestOptionsConfig().
    WithMaxContentLength(1000).
    WithMaxFileSizeMB(10).
    WithMaxFilesPerPost(5).
    WithRetroactivePostingEnabled(true).
    WithMarkdownEnabled(false)
```

## Available Methods

### Core Settings
- `WithMaxContentLength(val int)` - Set maximum content length
- `WithMaxFileSizeMB(val int)` - Set maximum file size in MB
- `WithMaxFilesPerPost(val int)` - Set maximum files per post

### Feature Toggles
- `WithActivityEnabled(enabled bool)` - Enable/disable activity feature
- `WithActivityPeriodMonths(months int)` - Set activity period in months
- `WithDetailedStatsEnabled(enabled bool)` - Enable/disable detailed stats
- `WithRetroactivePostingEnabled(enabled bool)` - Enable/disable retroactive posting
- `WithRetroactivePostingTimeFormat(format string)` - Set time format ("24h" or "12h")
- `WithMarkdownEnabled(enabled bool)` - Enable/disable markdown support

## Example

Before (old way):
```go
options := &config.OptionsConfig{
    Core: struct {
        MaxContentLength int `json:"maxContentLength"`
        MaxFileSizeMB    int `json:"maxFileSizeMB"`
        MaxFilesPerPost  int `json:"maxFilesPerPost"`
    }{
        MaxContentLength: 1000,
        MaxFileSizeMB:    10,
        MaxFilesPerPost:  5,
    },
    Features: struct {
        // ... many more lines of boilerplate
    }{
        // ... even more nested structs
    },
}
```

After (new way):
```go
options := config.NewTestOptionsConfig().
    WithMaxContentLength(1000).
    WithMaxFileSizeMB(10).
    WithMaxFilesPerPost(5)
```

## Benefits

1. **Centralized maintenance**: When `options.json` structure changes, update only `test_helpers.go`
2. **Less boilerplate**: Tests are more readable with method chaining
3. **Default values**: Get production-like defaults automatically
4. **Type safety**: All methods are type-safe and IDE-friendly
