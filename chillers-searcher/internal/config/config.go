package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds service configuration
type Config struct {
	Port            string
	BackendURL      string
	DefaultTimeout  time.Duration
	MaxWorkers      int
	UserAgent       string
}

// LoadConfig loads configuration from environment variables with safe defaults
func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8095"
	}

	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://localhost:4000"
	}

	timeoutSecStr := os.Getenv("SEARCH_TIMEOUT_SECONDS")
	timeoutSec := 30
	if timeoutSecStr != "" {
		if val, err := strconv.Atoi(timeoutSecStr); err == nil && val > 0 {
			timeoutSec = val
		}
	}

	maxWorkersStr := os.Getenv("MAX_CONCURRENT_WORKERS")
	maxWorkers := 10
	if maxWorkersStr != "" {
		if val, err := strconv.Atoi(maxWorkersStr); err == nil && val > 0 {
			maxWorkers = val
		}
	}

	userAgent := os.Getenv("SCRAPER_USER_AGENT")
	if userAgent == "" {
		userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
	}

	return &Config{
		Port:           port,
		BackendURL:     backendURL,
		DefaultTimeout: time.Duration(timeoutSec) * time.Second,
		MaxWorkers:     maxWorkers,
		UserAgent:      userAgent,
	}
}
