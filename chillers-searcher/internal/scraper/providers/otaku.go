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

	bestMatch := searchData.Results[0]

	// Si l'année est spécifiée pour un film et qu'il y a plusieurs résultats, chercher l'année correspondante
	if query.Type == domain.MediaTypeMovie && query.Year > 0 && len(searchData.Results) > 1 {
		type otakuWatchMeta struct {
			Meta struct {
				Year string `json:"year"`
			} `json:"meta"`
		}

		for _, cand := range searchData.Results {
			watchURL := fmt.Sprintf("%s/api/fs-watch?id=%s", otakuBaseURL, url.QueryEscape(cand.ID))
			wReq, wErr := http.NewRequestWithContext(ctx, http.MethodGet, watchURL, nil)
			if wErr == nil {
				wReq.Header.Set("User-Agent", otakuUA)
				wResp, wDoErr := s.client.Do(wReq)
				if wDoErr == nil {
					var wData otakuWatchMeta
					if json.NewDecoder(wResp.Body).Decode(&wData) == nil && wData.Meta.Year != "" {
						var y int
						fmt.Sscanf(wData.Meta.Year, "%d", &y)
						diff := y - query.Year
						if diff < 0 {
							diff = -diff
						}
						if diff <= 1 {
							bestMatch = cand
							wResp.Body.Close()
							slog.Info("Otaku: Exact year match found", "title", cand.Title, "year", y, "id", cand.ID)
							break
						}
					}
					wResp.Body.Close()
				}
			}
		}
	}

	var sources []domain.StreamSource

	// Fetch detail / download link if available
	dlURL := fmt.Sprintf("%s/api/dl?url=%s", otakuBaseURL, url.QueryEscape(bestMatch.ID))
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
					Language:  "VF",
					Server:    "direct",
					Season:    query.Season,
					Episode:   query.Episode,
				})
			}
		}
	}

	// Also add the primary page / embed reference
	if len(sources) == 0 && bestMatch.ID != "" {
		sources = append(sources, domain.StreamSource{
			Source:    "otaku",
			StreamURL: bestMatch.ID,
			Quality:   "HD",
			Language:  "VF",
			Server:    "otaku-player",
			Season:    query.Season,
			Episode:   query.Episode,
		})
	}

	slog.Info("Otaku: Search completed", "sourcesFound", len(sources))
	return sources, nil
}
