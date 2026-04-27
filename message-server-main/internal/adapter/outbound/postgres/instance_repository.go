package postgresrepo

import (
	"context"
	"errors"
	"time"

	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/txctx"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// InstanceRepository implementa instance.Repository sobre Postgres.
//
// Armazena o pool default e usa txctx.From(ctx, pool) em cada query:
// quando um caso de uso abre uma transacao via tx.Manager, o repo
// passa a executar dentro dela automaticamente, sem mudar a assinatura
// dos metodos do port.
type InstanceRepository struct {
	pool *pgxpool.Pool
}

// NewInstanceRepository constroi o repo.
func NewInstanceRepository(pool *pgxpool.Pool) *InstanceRepository {
	return &InstanceRepository{pool: pool}
}

const (
	codeInstanceConflict = "INSTANCE_ALREADY_EXISTS"
	codeInstanceNotFound = "INSTANCE_NOT_FOUND"
)

func (r *InstanceRepository) Create(ctx context.Context, inst *instance.Instance) error {
	const q = `
		INSERT INTO message_server.instances
			(id, company_id, name, status, whatsmeow_jid, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7)
	`
	_, err := txctx.From(ctx, r.pool).Exec(ctx, q,
		inst.ID(),
		inst.CompanyID(),
		inst.Name(),
		string(inst.Status()),
		inst.WhatsmeowJID(),
		inst.CreatedAt(),
		inst.UpdatedAt(),
	)
	return mapError(err, codeInstanceConflict, codeInstanceNotFound)
}

func (r *InstanceRepository) FindByID(ctx context.Context, instanceID id.ID) (*instance.Instance, error) {
	return r.findOne(ctx, `
		SELECT id, company_id, name, status, COALESCE(whatsmeow_jid, ''), created_at, updated_at
		FROM message_server.instances
		WHERE id = $1
	`, instanceID)
}

func (r *InstanceRepository) FindByCompany(ctx context.Context, companyID string) (*instance.Instance, error) {
	return r.findOne(ctx, `
		SELECT id, company_id, name, status, COALESCE(whatsmeow_jid, ''), created_at, updated_at
		FROM message_server.instances
		WHERE company_id = $1
	`, companyID)
}

func (r *InstanceRepository) findOne(ctx context.Context, sql string, arg any) (*instance.Instance, error) {
	row := txctx.From(ctx, r.pool).QueryRow(ctx, sql, arg)
	var (
		rid       string
		company   string
		name      string
		status    string
		jid       string
		createdAt time.Time
		updatedAt time.Time
	)
	if err := row.Scan(&rid, &company, &name, &status, &jid, &createdAt, &updatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, mapError(err, codeInstanceConflict, codeInstanceNotFound)
	}
	return instance.Hydrate(rid, company, name, instance.Status(status), jid, createdAt, updatedAt), nil
}

// ListAll devolve todas as instancias persistidas. Usado pelo
// Driver.RecoverSessions no boot para reconectar sessoes existentes.
func (r *InstanceRepository) ListAll(ctx context.Context) ([]*instance.Instance, error) {
	const q = `
		SELECT id, company_id, name, status, COALESCE(whatsmeow_jid, ''), created_at, updated_at
		FROM message_server.instances
		ORDER BY created_at
	`
	rows, err := txctx.From(ctx, r.pool).Query(ctx, q)
	if err != nil {
		return nil, mapError(err, codeInstanceConflict, codeInstanceNotFound)
	}
	defer rows.Close()
	var out []*instance.Instance
	for rows.Next() {
		var (
			rid       string
			company   string
			name      string
			status    string
			jid       string
			createdAt time.Time
			updatedAt time.Time
		)
		if err := rows.Scan(&rid, &company, &name, &status, &jid, &createdAt, &updatedAt); err != nil {
			return nil, mapError(err, codeInstanceConflict, codeInstanceNotFound)
		}
		out = append(out, instance.Hydrate(rid, company, name, instance.Status(status), jid, createdAt, updatedAt))
	}
	if err := rows.Err(); err != nil {
		return nil, mapError(err, codeInstanceConflict, codeInstanceNotFound)
	}
	return out, nil
}

func (r *InstanceRepository) UpdateStatus(ctx context.Context, instanceID id.ID, status instance.Status) error {
	const q = `
		UPDATE message_server.instances
		SET status = $2, updated_at = now()
		WHERE id = $1
	`
	tag, err := txctx.From(ctx, r.pool).Exec(ctx, q, instanceID, string(status))
	if err != nil {
		return mapError(err, codeInstanceConflict, codeInstanceNotFound)
	}
	if tag.RowsAffected() == 0 {
		return errs.New(errs.KindNotFound, codeInstanceNotFound, "instancia nao encontrada")
	}
	return nil
}

func (r *InstanceRepository) Delete(ctx context.Context, instanceID id.ID) error {
	const q = `DELETE FROM message_server.instances WHERE id = $1`
	tag, err := txctx.From(ctx, r.pool).Exec(ctx, q, instanceID)
	if err != nil {
		return mapError(err, codeInstanceConflict, codeInstanceNotFound)
	}
	if tag.RowsAffected() == 0 {
		return errs.New(errs.KindNotFound, codeInstanceNotFound, "instancia nao encontrada")
	}
	return nil
}

// UpdateWhatsmeowJID grava o JID atribuido pelo servidor WhatsApp apos
// o pareamento. Persistir e o que permite RecoverSessions reconectar
// sem QR code apos restart.
func (r *InstanceRepository) UpdateWhatsmeowJID(ctx context.Context, instanceID id.ID, jid string) error {
	const q = `
		UPDATE message_server.instances
		SET whatsmeow_jid = NULLIF($2, ''), updated_at = now()
		WHERE id = $1
	`
	tag, err := txctx.From(ctx, r.pool).Exec(ctx, q, instanceID, jid)
	if err != nil {
		return mapError(err, codeInstanceConflict, codeInstanceNotFound)
	}
	if tag.RowsAffected() == 0 {
		return errs.New(errs.KindNotFound, codeInstanceNotFound, "instancia nao encontrada")
	}
	return nil
}
