// Package txctx propaga uma transacao pgx.Tx atraves de context.Context.
//
// Padrao usado pelo TxManager (G2): o caso de uso abre uma transacao,
// injeta no ctx via With, e os repositorios recuperam a tx via From
// sem mudar suas assinaturas publicas. Quando nao ha tx no ctx, From
// devolve o fallback (tipicamente o *pgxpool.Pool).
package txctx

import (
	"context"

	pgxlib "github.com/IAtend-LOC/message-server/internal/platform/postgres"
	"github.com/jackc/pgx/v5"
)

type ctxKey struct{}

// With devolve um novo context carregando a transacao informada.
func With(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, ctxKey{}, tx)
}

// FromTx devolve a transacao presente no ctx, se houver.
func FromTx(ctx context.Context) (pgx.Tx, bool) {
	tx, ok := ctx.Value(ctxKey{}).(pgx.Tx)
	return tx, ok
}

// From devolve a tx presente no ctx, ou o fallback caso ausente.
// Use esta funcao em todo repositorio: garante que o repo participara
// de uma transacao externa sempre que iniciada via TxManager.
func From(ctx context.Context, fallback pgxlib.Querier) pgxlib.Querier {
	if tx, ok := FromTx(ctx); ok {
		return tx
	}
	return fallback
}
