package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"chillers-searcher/internal/domain"
)

type WebhookNotifier struct {
	client     *http.Client
	backendURL string
}

func NewWebhookNotifier(backendURL string) *WebhookNotifier {
	return &WebhookNotifier{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		backendURL: backendURL,
	}
}

// NotifyBackend sends the search result back to the Node.js backend via HTTP POST/PATCH
func (w *WebhookNotifier) NotifyBackend(ctx context.Context, result domain.SearchResult, callbackURL string) error {
	targetURL := callbackURL
	if targetURL == "" {
		targetURL = fmt.Sprintf("%s/api/internal/requests/%s/fulfill", w.backendURL, result.RequestID)
	}

	slog.Info("Notifier: Sending webhook to backend", "url", targetURL, "found", result.Found, "requestId", result.RequestID)

	payloadBytes, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Chillers-Searcher-Go/1.0")

	resp, err := w.client.Do(req)
	if err != nil {
		return fmt.Errorf("webhook delivery failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook responded with status: %d", resp.StatusCode)
	}

	slog.Info("Notifier: Webhook delivered successfully", "status", resp.StatusCode)
	return nil
}
