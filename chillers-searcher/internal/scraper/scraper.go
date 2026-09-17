package scraper

import (
	"context"
	"chillers-searcher/internal/domain"
)

// Scraper defines the contract that all streaming providers must implement
type Scraper interface {
	// Name returns the identifier of the scraper (e.g. "frenchstream", "otaku")
	Name() string

	// Supports returns true if the scraper supports this media type (movie, series)
	Supports(mediaType domain.MediaType) bool

	// Search executes the scraping logic and returns found stream sources
	Search(ctx context.Context, query domain.SearchQuery) ([]domain.StreamSource, error)
}
