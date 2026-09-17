package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"chillers-searcher/internal/domain"
)

const (
	otakuBaseURL = "https://www.open-otaku.me"
	otakuUA      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
)

type OtakuScraper struct {
	client *http.Client
}

func NewOtakuScraper() *OtakuScraper {
	return &OtakuScraper{
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (s *OtakuScraper) Name() string {
	return "otaku"
}

func (s *OtakuScraper) Supports(mediaType domain.MediaType) bool {
	return mediaType == domain.MediaTypeMovie || mediaType == domain.MediaTypeSeries
}

type otakuSearchResult struct {
	Results []struct {
		ID     string `json:"id"`
		Title  string `json:"title"`
		Poster string `json:"poster"`
	} `json:"results"`
}

type otakuDLResponse struct {
	Success     bool   `json:"success"`
	DownloadURL string `json:"downloadUrl"`
}

func (s *OtakuScraper) Search(ctx context.Context, query domain.SearchQuery) ([]domain.StreamSource, error) {
	slog.Info("Otaku: Starting search", "title", query.Title, "type", query.Type)

	searchTitle := query.Title
	if query.Type == domain.MediaTypeSeries && query.Season > 1 && !strings.Contains(strings.ToLower(query.Title), "saison") {
		searchTitle = fmt.Sprintf("%s Saison %d", query.Title, query.Season)
	}

	searchURL := fmt.Sprintf("%s/api/fs-search?q=%s", otakuBaseURL, url.QueryEscape(searchTitle))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, searchURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", otakuUA)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("otaku search request failed: %w", err)
	}
	defer resp.Body.Close()

	var searchData otakuSearchResult
	if err := json.NewDecoder(resp.Body).Decode(&searchData); err != nil {
		return nil, fmt.Errorf("failed to decode otaku search response: %w", err)
	}

	if len(searchData.Results) == 0 {
		slog.Debug("Otaku: No results found", "title", query.Title)
		return nil, nil
	}

	firstMatch := searchData.Results[0]
	var sources []domain.StreamSource

	// Fetch detail / download link if available
	dlURL := fmt.Sprintf("%s/api/dl?url=%s", otakuBaseURL, url.QueryEscape(firstMatch.ID))
	dlReq, err := http.NewRequestWithContext(ctx, http.MethodGet, dlURL, nil)
	if err == nil {
		dlReq.Header.Set("User-Agent", otakuUA)
		dlResp, dlErr := s.client.Do(dlReq)
		if dlErr == nil {
			defer dlResp.Body.Close()
			var dlData otakuDLResponse
			if err := json.NewDecoder(dlResp.Body).Decode(&dlData); err == nil && dlData.Success && dlData.DownloadURL != "" {
				sources = append(sources, domain.StreamSource{
					Source:    "otaku",
					StreamURL: dlData.DownloadURL,
					Quality:   "1080p",
					Language:  "VOSTFR",
					Server:    "direct",
					Season:    query.Season,
					Episode:   query.Episode,
				})
			}
		}
	}

	// Also add the primary page / embed reference
	if len(sources) == 0 && firstMatch.ID != "" {
		sources = append(sources, domain.StreamSource{
			Source:    "otaku",
			StreamURL: firstMatch.ID,
			Quality:   "HD",
			Language:  "VOSTFR",
			Server:    "otaku-player",
			Season:    query.Season,
			Episode:   query.Episode,
		})
	}

	slog.Info("Otaku: Search completed", "sourcesFound", len(sources))
	return sources, nil
}
