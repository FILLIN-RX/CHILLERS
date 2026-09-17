package providers

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"chillers-searcher/internal/domain"
	"github.com/PuerkitoBio/goquery"
)

const (
	frenchStreamBaseURL = "https://french-stream.one"
	frenchStreamUA      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

type FrenchStreamScraper struct {
	client *http.Client
}

func NewFrenchStreamScraper() *FrenchStreamScraper {
	return &FrenchStreamScraper{
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (s *FrenchStreamScraper) Name() string {
	return "frenchstream"
}

func (s *FrenchStreamScraper) Supports(mediaType domain.MediaType) bool {
	return mediaType == domain.MediaTypeMovie || mediaType == domain.MediaTypeSeries
}

func normalizeTitle(str string) string {
	re := regexp.MustCompile(`\s*\(\s*\d{4}\s*\)\s*$`)
	cleaned := re.ReplaceAllString(str, "")
	reg := regexp.MustCompile(`[^a-z0-9]`)
	return reg.ReplaceAllString(strings.ToLower(cleaned), "")
}

func (s *FrenchStreamScraper) Search(ctx context.Context, query domain.SearchQuery) ([]domain.StreamSource, error) {
	slog.Info("FrenchStream: Starting search", "title", query.Title, "type", query.Type)

	// Step 1: POST search request to AJAX endpoint
	formData := url.Values{}
	formData.Set("query", query.Title)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/engine/ajax/controller.php?mod=search", frenchStreamBaseURL), strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	req.Header.Set("User-Agent", frenchStreamUA)
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Referer", frenchStreamBaseURL+"/")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("frenchstream ajax search error: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	body := string(bodyBytes)

	// Regex for matches in AJAX response: location.href='url' ... img src='poster' ... search-title
	itemRegex := regexp.MustCompile(`(?i)location\.href='([^']+)'[\s\S]*?<div class='search-title'>([\s\S]*?)<\/div>`)
	matches := itemRegex.FindAllStringSubmatch(body, -1)

	if len(matches) == 0 {
		slog.Debug("FrenchStream: No AJAX matches found", "title", query.Title)
		return nil, nil
	}

	normQuery := normalizeTitle(query.Title)
	var targetPageURL string

	for _, match := range matches {
		matchURL := match[1]
		matchTitle := match[2]
		matchTitle = strings.ReplaceAll(matchTitle, "\\'", "'")
		matchTitle = strings.ReplaceAll(matchTitle, "&amp;", "&")

		normMatch := normalizeTitle(matchTitle)
		if strings.Contains(normMatch, normQuery) || strings.Contains(normQuery, normMatch) {
			if strings.HasPrefix(matchURL, "http") {
				targetPageURL = matchURL
			} else {
				targetPageURL = frenchStreamBaseURL + matchURL
			}
			break
		}
	}

	if targetPageURL == "" && len(matches) > 0 {
		firstURL := matches[0][1]
		if strings.HasPrefix(firstURL, "http") {
			targetPageURL = firstURL
		} else {
			targetPageURL = frenchStreamBaseURL + firstURL
		}
	}

	if targetPageURL == "" {
		return nil, nil
	}

	// Step 2: Fetch target media page to extract stream/embed URLs
	pageReq, err := http.NewRequestWithContext(ctx, http.MethodGet, targetPageURL, nil)
	if err != nil {
		return nil, err
	}
	pageReq.Header.Set("User-Agent", frenchStreamUA)
	pageReq.Header.Set("Referer", frenchStreamBaseURL+"/")

	pageResp, err := s.client.Do(pageReq)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch detail page: %w", err)
	}
	defer pageResp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(pageResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	var sources []domain.StreamSource

	// Options selector: <div class="option" data-url="..."><span>FRENCH</span></div>
	doc.Find("div.option[data-url]").Each(func(i int, s *goquery.Selection) {
		embedURL, exists := s.Attr("data-url")
		if !exists || embedURL == "" {
			return
		}
		lang := strings.TrimSpace(s.Find("span").Text())
		if lang == "" {
			lang = "VF"
		}

		server := "vidzy"
		if strings.Contains(embedURL, "sibnet") {
			server = "sibnet"
		} else if strings.Contains(embedURL, "uqload") {
			server = "uqload"
		} else if strings.Contains(embedURL, "dood") {
			server = "doodstream"
		}

		sources = append(sources, domain.StreamSource{
			Source:    "frenchstream",
			StreamURL: embedURL,
			Quality:   "HD",
			Language:  lang,
			Server:    server,
			Season:    query.Season,
			Episode:   query.Episode,
		})
	})

	slog.Info("FrenchStream: Found sources", "count", len(sources), "page", targetPageURL)
	return sources, nil
}
