package scraper

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"chillers-searcher/internal/domain"
)

// Engine coordinates multiple scrapers in parallel using goroutines and channels
type Engine struct {
	scrapers []Scraper
	timeout  time.Duration
}

// NewEngine creates a new search orchestration engine
func NewEngine(timeout time.Duration, scrapers ...Scraper) *Engine {
	return &Engine{
		scrapers: scrapers,
		timeout:  timeout,
	}
}

// SearchAll executes all compatible scrapers in parallel (Fan-Out / Fan-In)
func (e *Engine) SearchAll(ctx context.Context, query domain.SearchQuery) domain.SearchResult {
	start := time.Now()
	searchCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()

	// Filter scrapers supporting this media type
	var activeScrapers []Scraper
	for _, s := range e.scrapers {
		if s.Supports(query.Type) {
			activeScrapers = append(activeScrapers, s)
		}
	}

	if len(activeScrapers) == 0 {
		return domain.SearchResult{
			RequestID:   query.RequestID,
			TMDBID:      query.TMDBID,
			Type:        query.Type,
			Found:       false,
			DurationMs:  time.Since(start).Milliseconds(),
			CompletedAt: time.Now(),
		}
	}

	resultsChan := make(chan []domain.StreamSource, len(activeScrapers))
	var wg sync.WaitGroup

	slog.Info("Engine: Dispatching parallel scrapers", "count", len(activeScrapers), "title", query.Title)

	// Fan-Out: Launch one goroutine per scraper
	for _, sc := range activeScrapers {
		wg.Add(1)
		go func(s Scraper) {
			defer wg.Done()
			sources, err := s.Search(searchCtx, query)
			if err != nil {
				slog.Warn("Scraper encountered error", "scraper", s.Name(), "error", err)
				return
			}
			if len(sources) > 0 {
				select {
				case resultsChan <- sources:
				case <-searchCtx.Done():
				}
			}
		}(sc)
	}

	// Fan-In closer
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	var allSources []domain.StreamSource
	for sources := range resultsChan {
		allSources = append(allSources, sources...)
	}

	duration := time.Since(start).Milliseconds()
	found := len(allSources) > 0

	slog.Info("Engine: Search completed", "found", found, "totalSources", len(allSources), "durationMs", duration)

	return domain.SearchResult{
		RequestID:   query.RequestID,
		TMDBID:      query.TMDBID,
		Type:        query.Type,
		Found:       found,
		Sources:     allSources,
		DurationMs:  duration,
		CompletedAt: time.Now(),
	}
}
