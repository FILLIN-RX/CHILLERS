package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"chillers-searcher/internal/domain"
	"chillers-searcher/internal/notifier"
	"chillers-searcher/internal/scraper"
)

type SearchHandler struct {
	engine   *scraper.Engine
	notifier *notifier.WebhookNotifier
	jobsLock sync.RWMutex
	jobs     map[string]*domain.JobState
}

func NewSearchHandler(engine *scraper.Engine, notifier *notifier.WebhookNotifier) *SearchHandler {
	return &SearchHandler{
		engine:   engine,
		notifier: notifier,
		jobs:     make(map[string]*domain.JobState),
	}
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// HandleSearch processes POST /search
func (h *SearchHandler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var query domain.SearchQuery
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		slog.Warn("Invalid search request payload", "error", err)
		http.Error(w, `{"error":"Invalid JSON body"}`, http.StatusBadRequest)
		return
	}

	if query.Title == "" {
		http.Error(w, `{"error":"Title is required"}`, http.StatusBadRequest)
		return
	}

	if query.Type == "" {
		query.Type = domain.MediaTypeMovie
	}

	jobID := generateID()
	if query.RequestID == "" {
		query.RequestID = jobID
	}

	job := &domain.JobState{
		ID:        jobID,
		Query:     query,
		Status:    "searching",
		CreatedAt: time.Now(),
	}

	h.jobsLock.Lock()
	h.jobs[jobID] = job
	h.jobsLock.Unlock()

	// Launch background scraping goroutine
	go func(j *domain.JobState, q domain.SearchQuery) {
		ctx := context.Background()
		result := h.engine.SearchAll(ctx, q)

		h.jobsLock.Lock()
		j.Status = "completed"
		j.Result = &result
		h.jobsLock.Unlock()

		// Send webhook callback to Node.js backend
		if q.CallbackURL != "" || q.RequestID != "" {
			err := h.notifier.NotifyBackend(ctx, result, q.CallbackURL)
			if err != nil {
				slog.Error("Failed to notify backend", "error", err, "requestId", q.RequestID)
			}
		}
	}(job, query)

	// Return 202 Accepted immediately
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"jobId":     jobID,
		"requestId": query.RequestID,
		"status":    "searching",
		"message":   "Search job started in background",
	})
}

// HandleJobStatus processes GET /jobs/{id}
func (h *SearchHandler) HandleJobStatus(w http.ResponseWriter, r *http.Request) {
	jobID := r.URL.Path[len("/jobs/"):]
	if jobID == "" {
		http.Error(w, "Job ID required", http.StatusBadRequest)
		return
	}

	h.jobsLock.RLock()
	job, exists := h.jobs[jobID]
	h.jobsLock.RUnlock()

	if !exists {
		http.Error(w, `{"error":"Job not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}
