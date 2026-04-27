// relay.go: drena a tabela outbox para Kafka.
//
// Single-writer loop por replica:
//   - SELECT FOR UPDATE SKIP LOCKED (multi-replica safe);
//   - publica no sink;
//   - sucesso => UPDATE published_at = now();
//   - falha   => UPDATE attempts++, last_error -- proximo poll tenta de novo
//                respeitando backoff exponencial (1s, 2s, 4s ... cap 5min).
//
// Garantia: o evento esta atomicamente persistido junto com o estado
// do agregado (publisher dentro da tx do UC). Aqui apenas garantimos
// que cedo ou tarde ele chega no broker.
package outbox

import (
	"context"
	"encoding/json"
	"errors"
	"expvar"
	"fmt"
	"time"

	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/platform/metrics"
	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultBatchSize    = 100
	defaultPollInterval = 500 * time.Millisecond
	maxBackoff          = 5 * time.Minute
)

// Metricas internas (G2). Em G4 sao reaproveitadas via export Prometheus.
var (
	metricPending   = expvar.NewInt("outbox_pending")
	metricPublished = expvar.NewInt("outbox_published_total")
	metricFailed    = expvar.NewInt("outbox_failed_total")
)

// Sink e a interface minima exigida pelo relay (apenas Produce). Manter
// esta interface enxuta facilita testar o relay com um mock e evita
// acoplar ciclo de vida do cliente Kafka aqui (Close fica no bootstrap).
type Sink interface {
	Produce(ctx context.Context, r kafka.Record) error
}

// Relay e o loop assincrono que drena a tabela outbox.
type Relay struct {
	pool         *pgxpool.Pool
	sink         Sink
	log          logger.Logger
	metrics      *metrics.Metrics
	batchSize    int
	pollInterval time.Duration
}

// NewRelay constroi o relay com defaults seguros. metrics pode ser nil
// (testes unitarios nao precisam do registro Prometheus).
func NewRelay(pool *pgxpool.Pool, sink Sink, log logger.Logger, m *metrics.Metrics, batchSize int, pollInterval time.Duration) *Relay {
	if batchSize <= 0 {
		batchSize = defaultBatchSize
	}
	if pollInterval <= 0 {
		pollInterval = defaultPollInterval
	}
	return &Relay{
		pool:         pool,
		sink:         sink,
		log:          log,
		metrics:      m,
		batchSize:    batchSize,
		pollInterval: pollInterval,
	}
}

// Run bloqueia ate ctx ser cancelado, executando processBatch em loop.
func (r *Relay) Run(ctx context.Context) error {
	r.log.Info(ctx, "outbox relay starting", "batch_size", r.batchSize, "poll_interval", r.pollInterval.String())
	ticker := time.NewTicker(r.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			r.log.Info(context.Background(), "outbox relay stopped")
			return nil
		default:
		}

		processed, err := r.processBatch(ctx)
		if err != nil && !errors.Is(err, context.Canceled) {
			r.log.Error(ctx, "outbox: processBatch failed", "err", err.Error())
		}

		// Quando a fila esta cheia, tenta de novo imediatamente.
		if processed >= r.batchSize {
			continue
		}

		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

// outboxRow espelha as colunas retornadas pelo SELECT.
type outboxRow struct {
	ID       string
	Topic    string
	Key      []byte
	Payload  []byte
	Headers  []byte
	Attempts int
}

// processBatch seleciona, publica e marca em uma unica transacao.
//
// Pode haver lag entre commit local e visibilidade para outras replicas
// pos `SKIP LOCKED`, mas sem perda nem duplicacao -- os UPDATEs ficam
// no escopo da mesma tx que segurou o lock.
func (r *Relay) processBatch(ctx context.Context) (int, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return 0, fmt.Errorf("outbox relay: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	const sel = `
		SELECT id::text, topic, key, payload, headers, attempts
		FROM message_server.outbox
		WHERE published_at IS NULL
		  AND (attempts = 0 OR now() >= created_at + (
		        LEAST(power(2::numeric, attempts), 300)::int * interval '1 second'
		      ))
		ORDER BY created_at
		LIMIT $1
		FOR UPDATE SKIP LOCKED
	`
	rows, err := tx.Query(ctx, sel, r.batchSize)
	if err != nil {
		return 0, fmt.Errorf("outbox relay: select: %w", err)
	}
	var batch []outboxRow
	for rows.Next() {
		var row outboxRow
		if err := rows.Scan(&row.ID, &row.Topic, &row.Key, &row.Payload, &row.Headers, &row.Attempts); err != nil {
			rows.Close()
			return 0, fmt.Errorf("outbox relay: scan: %w", err)
		}
		batch = append(batch, row)
	}
	rows.Close()
	if rerr := rows.Err(); rerr != nil {
		return 0, fmt.Errorf("outbox relay: rows: %w", rerr)
	}

	for _, row := range batch {
		headers, hErr := decodeHeaders(row.Headers)
		if hErr != nil {
			r.markFailed(ctx, tx, row, hErr)
			metricFailed.Add(1)
			if r.metrics != nil {
				r.metrics.OutboxFailedTotal.WithLabelValues(row.Topic, "decode_headers").Inc()
			}
			continue
		}
		rec := kafka.Record{
			Topic:   row.Topic,
			Key:     row.Key,
			Value:   row.Payload,
			Headers: headers,
		}
		if pErr := r.sink.Produce(ctx, rec); pErr != nil {
			r.markFailed(ctx, tx, row, pErr)
			metricFailed.Add(1)
			if r.metrics != nil {
				r.metrics.OutboxFailedTotal.WithLabelValues(row.Topic, "produce").Inc()
			}
			r.log.Warn(ctx, "outbox: produce failed",
				"outbox_id", row.ID,
				"topic", row.Topic,
				"attempts", row.Attempts+1,
				"err", pErr.Error(),
			)
			continue
		}
		const upd = `UPDATE message_server.outbox SET published_at = now(), last_error = NULL WHERE id = $1`
		if _, uErr := tx.Exec(ctx, upd, row.ID); uErr != nil {
			return 0, fmt.Errorf("outbox relay: mark published: %w", uErr)
		}
		metricPublished.Add(1)
		if r.metrics != nil {
			r.metrics.OutboxPublishedTotal.WithLabelValues(row.Topic).Inc()
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("outbox relay: commit: %w", err)
	}

	r.refreshPending(ctx)
	return len(batch), nil
}

// markFailed atualiza attempts/last_error preservando published_at NULL.
// Best-effort: erro de update nao deve abortar o batch inteiro.
func (r *Relay) markFailed(ctx context.Context, tx pgx.Tx, row outboxRow, cause error) {
	const upd = `
		UPDATE message_server.outbox
		SET attempts = attempts + 1, last_error = $2
		WHERE id = $1
	`
	if _, err := tx.Exec(ctx, upd, row.ID, cause.Error()); err != nil {
		r.log.Warn(ctx, "outbox: mark failed update error", "outbox_id", row.ID, "err", err.Error())
	}
}

// refreshPending atualiza a metrica outbox_pending. Best-effort.
func (r *Relay) refreshPending(ctx context.Context) {
	const q = `SELECT count(*) FROM message_server.outbox WHERE published_at IS NULL`
	var n int64
	if err := r.pool.QueryRow(ctx, q).Scan(&n); err != nil {
		return
	}
	metricPending.Set(n)
	if r.metrics != nil {
		r.metrics.OutboxPending.Set(float64(n))
	}
}

// decodeHeaders converte o jsonb (map[string]string) em headers Kafka.
func decodeHeaders(raw []byte) (map[string][]byte, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var m map[string]string
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("outbox: decode headers: %w", err)
	}
	if len(m) == 0 {
		return nil, nil
	}
	out := make(map[string][]byte, len(m))
	for k, v := range m {
		out[k] = []byte(v)
	}
	return out, nil
}
