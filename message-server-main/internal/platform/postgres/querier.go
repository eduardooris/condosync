// Package postgres encapsula o pool pgx e a interface Querier consumida
// pelos repositorios. Querier e satisfeito tanto por *pgxpool.Pool
// quanto por pgx.Tx, permitindo que repositorios participem de uma
// transacao externa (ver outbox/tx em G2) sem mudar assinatura.
package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Querier e a interface minima de execucao SQL usada pelos repositorios.
//
// Implementacoes:
//   - *pgxpool.Pool   (uso default, fora de transacao);
//   - pgx.Tx          (uso dentro de uma transacao gerenciada por TxManager).
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}
