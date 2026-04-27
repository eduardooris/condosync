package postgresrepo

import (
	"context"
	"errors"

	"github.com/IAtend-LOC/message-server/internal/domain/message"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/txctx"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MessageRepository implementa message.Repository sobre Postgres.
type MessageRepository struct {
	pool *pgxpool.Pool
}

// NewMessageRepository constroi o repo.
func NewMessageRepository(pool *pgxpool.Pool) *MessageRepository {
	return &MessageRepository{pool: pool}
}

const codeMessageInstanceMissing = "INSTANCE_NOT_FOUND"

// Save insere a mensagem de forma idempotente.
//
// Retorna inserted=false sem erro quando o conflito for em
// (instance_id, wpp_id, direction) -- a mensagem ja foi observada antes.
// Erros de FK (instance_id ausente) sao traduzidos para KindNotFound
// com codigo INSTANCE_NOT_FOUND.
func (r *MessageRepository) Save(ctx context.Context, msg *message.Message) (bool, error) {
	const q = `
		INSERT INTO message_server.messages
			(id, instance_id, wpp_id, direction, kind,
			 peer_from, peer_to, body, occurred_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (instance_id, wpp_id, direction) DO NOTHING
	`
	tag, err := txctx.From(ctx, r.pool).Exec(ctx, q,
		msg.ID(),
		msg.InstanceID(),
		msg.WppID(),
		string(msg.Direction()),
		string(msg.Kind()),
		msg.From(),
		msg.To(),
		msg.Body(),
		msg.Timestamp(),
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgerrcode.ForeignKeyViolation {
			return false, mapError(err, "", codeMessageInstanceMissing)
		}
		return false, mapError(err, "", "")
	}
	return tag.RowsAffected() == 1, nil
}

// ExistsByWppID consulta se uma mensagem ja foi persistida.
func (r *MessageRepository) ExistsByWppID(
	ctx context.Context,
	instanceID id.ID,
	wppID string,
	dir message.Direction,
) (bool, error) {
	const q = `
		SELECT 1
		FROM message_server.messages
		WHERE instance_id = $1 AND wpp_id = $2 AND direction = $3
	`
	var one int
	err := txctx.From(ctx, r.pool).QueryRow(ctx, q, instanceID, wppID, string(dir)).Scan(&one)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, mapError(err, "", "")
	}
	return true, nil
}
