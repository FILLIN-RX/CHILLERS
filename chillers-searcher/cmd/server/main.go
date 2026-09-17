package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"chillers-searcher/internal/config"
	"chillers-searcher/internal/handler"
	"chillers-searcher/internal/notifier"
	"chillers-searcher/internal/scraper"
	"chillers-searcher/internal/scraper/providers"
)

func main() {
	// 1. Structured Logging Setup (JSON in production, text in local)
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	// 2. Load Configuration
	cfg := config.LoadConfig()
	slog.Info("Starting Chillers-Searcher Microservice", "port", cfg.Port, "backendURL", cfg.BackendURL)

	// 3. Initialize Scrapers & Engine
	otakuScraper := providers.NewOtakuScraper()
	frenchStreamScraper := providers.NewFrenchStreamScraper()
	engine := scraper.NewEngine(cfg.DefaultTimeout, otakuScraper, frenchStreamScraper)

	// 4. Initialize Notifier & Handlers
	webhookNotifier := notifier.NewWebhookNotifier(cfg.BackendURL)
	searchHandler := handler.NewSearchHandler(engine, webhookNotifier)
	healthHandler := handler.NewHealthHandler()

	// 5. Setup Router
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler.ServeHTTP)
	mux.HandleFunc("/search", searchHandler.HandleSearch)
	mux.HandleFunc("/jobs/", searchHandler.HandleJobStatus)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 6. Start server in a background goroutine
	go func() {
		slog.Info(fmt.Sprintf("⚡ Chillers Searcher listening on http://localhost:%s", cfg.Port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed", "error", err)
			os.Exit(1)
		}
	}()

	// 7. Graceful Shutdown listener
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Server stopped cleanly")
}
