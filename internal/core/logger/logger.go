package logger

import (
	"backthynk/internal/config"
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type Logger struct {
	storagePath       string
	displayLogs       bool
	enableRequestLogs bool
	warningFile       *os.File
	errorFile         *os.File
	zapLogger         *zap.Logger
	mu                sync.Mutex
}

var (
	globalLogger *Logger
	once         sync.Once
)

// Initialize initializes the global logger
func Initialize(storagePath string, displayLogs, enableRequestLogs bool) error {
	var err error
	once.Do(func() {
		globalLogger, err = newLogger(storagePath, displayLogs, enableRequestLogs)
	})
	return err
}

// GetLogger returns the global logger instance
func GetLogger() *Logger {
	return globalLogger
}

func newLogger(storagePath string, displayLogs, enableRequestLogs bool) (*Logger, error) {
	// Create storage directory if it doesn't exist
	if err := os.MkdirAll(storagePath, config.DirectoryPermissions); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	l := &Logger{
		storagePath:       storagePath,
		displayLogs:       displayLogs,
		enableRequestLogs: enableRequestLogs,
	}

	// Open warning file
	warningPath := filepath.Join(storagePath, "warnings.log")
	wf, err := os.OpenFile(warningPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, config.FilePermissions)
	if err != nil {
		return nil, fmt.Errorf("failed to open warnings.log: %w", err)
	}
	l.warningFile = wf

	// Open error file
	errorPath := filepath.Join(storagePath, "errors.log")
	ef, err := os.OpenFile(errorPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, config.FilePermissions)
	if err != nil {
		wf.Close()
		return nil, fmt.Errorf("failed to open errors.log: %w", err)
	}
	l.errorFile = ef

	// Set up zap logger
	if err := l.setupZapLogger(); err != nil {
		wf.Close()
		ef.Close()
		return nil, err
	}

	return l, nil
}

func (l *Logger) setupZapLogger() error {
	// Create encoder config
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "time",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.CapitalLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	// Create encoder
	encoder := zapcore.NewConsoleEncoder(encoderConfig)

	// Create cores for different log levels
	var cores []zapcore.Core

	// Info core (console only if displayLogs is true)
	if l.displayLogs {
		infoCore := zapcore.NewCore(
			encoder,
			zapcore.AddSync(os.Stdout),
			zapcore.InfoLevel,
		)
		cores = append(cores, infoCore)
	}

	// Warning core (file always, console if displayLogs is true)
	warningFileCore := zapcore.NewCore(
		encoder,
		zapcore.AddSync(l.warningFile),
		zapcore.WarnLevel,
	)
	cores = append(cores, warningFileCore)

	if l.displayLogs {
		warningConsoleCore := zapcore.NewCore(
			encoder,
			zapcore.AddSync(os.Stdout),
			zapcore.WarnLevel,
		)
		cores = append(cores, warningConsoleCore)
	}

	// Error core (file always, console if displayLogs is true)
	errorFileCore := zapcore.NewCore(
		encoder,
		zapcore.AddSync(l.errorFile),
		zapcore.ErrorLevel,
	)
	cores = append(cores, errorFileCore)

	if l.displayLogs {
		errorConsoleCore := zapcore.NewCore(
			encoder,
			zapcore.AddSync(os.Stderr),
			zapcore.ErrorLevel,
		)
		cores = append(cores, errorConsoleCore)
	}

	// Combine all cores
	core := zapcore.NewTee(cores...)

	// Create logger with caller info (skip 1 level to show actual caller, not logger wrapper)
	l.zapLogger = zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))

	return nil
}

// Info logs an informational message
func (l *Logger) Info(msg string, fields ...zap.Field) {
	l.zapLogger.Info(msg, fields...)
}

// Infof logs a formatted informational message
func (l *Logger) Infof(format string, args ...interface{}) {
	l.zapLogger.Info(fmt.Sprintf(format, args...))
}

// Warning logs a warning message
func (l *Logger) Warning(msg string, fields ...zap.Field) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.zapLogger.Warn(msg, fields...)
	l.checkAndRotate(l.warningFile, "warnings.log")
}

// Warningf logs a formatted warning message
func (l *Logger) Warningf(format string, args ...interface{}) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.zapLogger.Warn(fmt.Sprintf(format, args...))
	l.checkAndRotate(l.warningFile, "warnings.log")
}

// Error logs an error message
func (l *Logger) Error(msg string, fields ...zap.Field) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.zapLogger.Error(msg, fields...)
	l.checkAndRotate(l.errorFile, "errors.log")
}

// Errorf logs a formatted error message
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.zapLogger.Error(fmt.Sprintf(format, args...))
	l.checkAndRotate(l.errorFile, "errors.log")
}

// LogRequest logs an HTTP request
func (l *Logger) LogRequest(method, uri string, status, size int, duration time.Duration) {
	if !l.enableRequestLogs {
		return
	}
	l.Info("HTTP request",
		zap.String("method", method),
		zap.String("uri", uri),
		zap.Int("status", status),
		zap.Int("size", size),
		zap.Duration("duration", duration),
	)
}

// checkAndRotate checks if the log file exceeds the size limit and rotates it
func (l *Logger) checkAndRotate(file *os.File, filename string) {
	info, err := file.Stat()
	if err != nil {
		return
	}

	// Check if file size exceeds limit (in KB)
	fileSizeKB := info.Size() / 1024
	if fileSizeKB < int64(config.MaxLogFileSizeKB) {
		return
	}

	// Rotate the file
	if err := l.rotateFile(file, filename); err != nil {
		l.zapLogger.Error("Failed to rotate log file",
			zap.String("file", filename),
			zap.Error(err),
		)
	}
}

// rotateFile splits the log file by removing the oldest half of lines
func (l *Logger) rotateFile(file *os.File, filename string) error {
	filePath := filepath.Join(l.storagePath, filename)

	// Sync and close the current file
	file.Sync()
	file.Close()

	// Open file for reading
	f, err := os.Open(filePath)
	if err != nil {
		return err
	}

	// Read all lines
	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	f.Close()

	if err := scanner.Err(); err != nil {
		return err
	}

	// Keep only the second half of lines
	totalLines := len(lines)
	if totalLines == 0 {
		return nil
	}

	keepFromIndex := totalLines / 2
	linesToKeep := lines[keepFromIndex:]

	// Write the remaining lines back to the file
	newFile, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, config.FilePermissions)
	if err != nil {
		return err
	}

	writer := bufio.NewWriter(newFile)
	for _, line := range linesToKeep {
		fmt.Fprintln(writer, line)
	}
	writer.Flush()
	newFile.Close()

	// Reopen file in append mode
	reopened, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, config.FilePermissions)
	if err != nil {
		return err
	}

	// Update the file reference
	if filename == "warnings.log" {
		l.warningFile = reopened
	} else if filename == "errors.log" {
		l.errorFile = reopened
	}

	// Recreate zap logger with new file handles
	l.zapLogger.Sync()
	if err := l.setupZapLogger(); err != nil {
		return err
	}

	return nil
}

// ReadLogs reads the last n lines from warning and/or error logs
func (l *Logger) ReadLogs(logType string, lastNLines int) ([]string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Sync files before reading
	l.warningFile.Sync()
	l.errorFile.Sync()

	var filesToRead []string

	switch logType {
	case "warnings":
		filesToRead = []string{filepath.Join(l.storagePath, "warnings.log")}
	case "errors":
		filesToRead = []string{filepath.Join(l.storagePath, "errors.log")}
	case "both":
		filesToRead = []string{
			filepath.Join(l.storagePath, "warnings.log"),
			filepath.Join(l.storagePath, "errors.log"),
		}
	default:
		return nil, fmt.Errorf("invalid log type: %s (must be 'warnings', 'errors', or 'both')", logType)
	}

	var allLines []string

	for _, filePath := range filesToRead {
		lines, err := readLastNLines(filePath, lastNLines)
		if err != nil {
			// If file doesn't exist, skip it
			if os.IsNotExist(err) {
				continue
			}
			return nil, err
		}
		allLines = append(allLines, lines...)
	}

	// If requesting both files and we want to limit total lines
	if logType == "both" && len(allLines) > lastNLines {
		// Return the last N lines from the combined result
		allLines = allLines[len(allLines)-lastNLines:]
	}

	return allLines, nil
}

// readLastNLines reads the last n lines from a file
func readLastNLines(filePath string, n int) ([]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// Return last n lines
	if len(lines) <= n {
		return lines, nil
	}

	return lines[len(lines)-n:], nil
}

// Close closes the log files and syncs the logger
func (l *Logger) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Sync zap logger
	if l.zapLogger != nil {
		l.zapLogger.Sync()
	}

	var errs []error
	if err := l.warningFile.Close(); err != nil {
		errs = append(errs, err)
	}
	if err := l.errorFile.Close(); err != nil {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors closing log files: %v", errs)
	}
	return nil
}

// DisableLogging disables all logging output (for tests)
func DisableLogging() {
	if globalLogger != nil {
		globalLogger.mu.Lock()
		defer globalLogger.mu.Unlock()
		globalLogger.displayLogs = false
		globalLogger.enableRequestLogs = false

		// Recreate zap logger with disabled output
		if globalLogger.zapLogger != nil {
			globalLogger.zapLogger.Sync()
			globalLogger.setupZapLogger()
		}
	}
}

// Global convenience functions
func Info(msg string, fields ...zap.Field) {
	if globalLogger != nil {
		globalLogger.Info(msg, fields...)
	}
}

func Infof(format string, args ...interface{}) {
	if globalLogger != nil {
		globalLogger.Infof(format, args...)
	}
}

func Warning(msg string, fields ...zap.Field) {
	if globalLogger != nil {
		globalLogger.Warning(msg, fields...)
	}
}

func Warningf(format string, args ...interface{}) {
	if globalLogger != nil {
		globalLogger.Warningf(format, args...)
	}
}

func Error(msg string, fields ...zap.Field) {
	if globalLogger != nil {
		globalLogger.Error(msg, fields...)
	}
}

func Errorf(format string, args ...interface{}) {
	if globalLogger != nil {
		globalLogger.Errorf(format, args...)
	}
}
