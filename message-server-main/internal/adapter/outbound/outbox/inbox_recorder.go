// inbox_recorder.go: registra eventos consumidos para garantir
// idempotencia logica end-to-end no consumer.
package outbox

import (
	"context"
	"fmt"

	"github.com/IAtend-LOC/message-server/internal/platform/postgres/txctx"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Recorder grava na tabela message_server.inbox.
//
// MarkProcessed e idempotente por design: usa INSERT ... ON CONFLICT
// DO NOTHING e devolve firstTime=false quando o event_id ja existia
// (reentrega Kafka).
type Recorder struct {
	pool *pgxpool.Pool
}

// NewRecorder constroi o recorder.
func NewRecorder(pool *pgxpool.Pool) *Recorder {
	return &Recorder{pool: pool}
}

// MarkProcessed insere o par (event_id, topic) na inbox.
//
// Retorna firstTime=true quando inseriu (1 linha afetada) e false em
// conflito (evento ja processado anteriormente). Usa a tx do ctx
// quando presente, senao o pool.
func (r *Recorder) MarkProcessed(ctx context.Context, eventID, topic string) (bool, error) {
	const q = `
		INSERT INTO message_server.inbox (event_id, topic)
		VALUES ($1, $2)
		ON CONFLICT (event_id) DO NOTHING
	`
	tag, err := txctx.From(ctx, r.pool).Exec(ctx, q, eventID, topic)
	if err != nil {
		return false, fmt.Errorf("inbox: insert event_id=%s: %w", eventID, err)
	}
	return tag.RowsAffected() == 1, nil
}
