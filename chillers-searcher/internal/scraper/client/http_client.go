package client

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// HTTPClient is an optimized wrapper around *http.Client with pooled connections
type HTTPClient struct {
	client    *http.Client
	userAgent string
}

// NewHTTPClient creates an HTTP client with high-performance transport settings
func NewHTTPClient(userAgent string, timeout time.Duration) *HTTPClient {
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression: false,
	}

	return &HTTPClient{
		client: &http.Client{
			Transport: transport,
			Timeout:   timeout,
		},
		userAgent: userAgent,
	}
}

// Get executes a GET request with proper headers and returns response body
func (c *HTTPClient) Get(ctx context.Context, targetURL string, customHeaders map[string]string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")

	for k, v := range customHeaders {
		req.Header.Set(k, v)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return nil, fmt.Errorf("http status error: %d %s", resp.StatusCode, resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body failed: %w", err)
	}

	return body, nil
}
