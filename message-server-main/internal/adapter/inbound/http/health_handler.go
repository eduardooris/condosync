// Package inboundhttp expoe os endpoints HTTP de saude.
//
// Em G4 separamos liveness (processo vivo) de readiness (deps prontas)
// para honrar a semantica de probes do Kubernetes:
//
//   /health/live  -> processo respondendo. Nao toca em deps. 200 sempre.
//   /health/ready -> dependencias OK (Postgres). 200 ou 503.
package inboundhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/jackc/pgx/v5/pgxpool"
)

const readyPingTimeout = 2 * time.Second

// Live responde 200 sem inspecionar dependencias.
func Live() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// Ready faz pool.Ping em ate readyPingTimeout. 503 quando o banco
// estiver indisponivel.
func Ready(pool *pgxpool.Pool, log logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), readyPingTimeout)
		defer cancel()

		w.Header().Set("Content-Type", "application/json")
		if err := pool.Ping(ctx); err != nil {
			log.Warn(r.Context(), "health: postgres ping failed", "err", err.Error())
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"status": "unavailable",
				"reason": "postgres",
			})
			return
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
