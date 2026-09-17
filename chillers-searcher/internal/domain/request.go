package domain

import "time"

// MediaType represents the type of media requested
type MediaType string

const (
	MediaTypeMovie  MediaType = "movie"
	MediaTypeSeries MediaType = "series"
)

// SearchQuery represents the input payload received from Node.js backend
type SearchQuery struct {
	RequestID   string    `json:"requestId"`
	TMDBID      int       `json:"tmdbId"`
	Title       string    `json:"title"`
	Type        MediaType `json:"type"`
	Season      int       `json:"season,omitempty"`
	Episode     int       `json:"episode,omitempty"`
	Year        int       `json:"year,omitempty"`
	CallbackURL string    `json:"callbackUrl,omitempty"`
}

// StreamSource represents a found streaming link
type StreamSource struct {
	Source    string `json:"source"`    // "otaku", "frenchstream", etc.
	StreamURL string `json:"streamUrl"` // player / embed / direct link
	Quality   string `json:"quality"`   // "1080p", "720p", "HD"
	Language  string `json:"language"`  // "VF", "VOSTFR"
	Server    string `json:"server"`    // "sibnet", "uqload", "doodstream", "vidmoly"
	Season    int    `json:"season,omitempty"`
	Episode   int    `json:"episode,omitempty"`
}

// SearchResult represents the aggregated result sent back to Node.js backend
type SearchResult struct {
	RequestID   string         `json:"requestId"`
	TMDBID      int            `json:"tmdbId"`
	Type        MediaType      `json:"type"`
	Found       bool           `json:"found"`
	Sources     []StreamSource `json:"sources"`
	DurationMs  int64          `json:"durationMs"`
	Error       string         `json:"error,omitempty"`
	CompletedAt time.Time      `json:"completedAt"`
}

// JobState represents an in-memory job status for monitoring
type JobState struct {
	ID        string       `json:"id"`
	Query     SearchQuery  `json:"query"`
	Status    string       `json:"status"` // "searching", "completed", "failed"
	CreatedAt time.Time    `json:"createdAt"`
	Result    *SearchResult `json:"result,omitempty"`
}
