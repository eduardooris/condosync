// Package tx oferece um TxManager para coordenar transacoes Postgres
// fora dos repositorios.
//
// Casos de uso que mutam estado e disparam eventos devem envolver toda
// a operacao em Manager.RunInTx. Isto garante que (a) a mutacao e a
// insercao no outbox aconteca na MESMA transacao, e (b) reentregas
// que reusam o ctx (ver IdempotentHandler em G2.2) reaproveitem a tx
// sem aninhamento real.
package tx

import (
	"context"
	"errors"
	"fmt"

	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/txctx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Manager abre/comita transacoes em cima de um *pgxpool.Pool.
type Manager struct {
	pool *pgxpool.Pool
	log  logger.Logger
}

// NewManager constroi o gerenciador.
func NewManager(pool *pgxpool.Pool, log logger.Logger) *Manager {
	return &Manager{pool: pool, log: log}
}

// Run e o atalho usado pelas camadas application/adapter para nao
// importar pgx apenas para passar pgx.TxOptions{}. Equivalente a
// RunInTx(ctx, pgx.TxOptions{}, fn). Satisfaz ports.TxRunner.
func (m *Manager) Run(ctx context.Context, fn func(ctx context.Context) error) error {
	return m.RunInTx(ctx, pgx.TxOptions{}, fn)
}

// RunInTx executa fn dentro de uma transacao Postgres.
//
// Comportamento:
//   - se ja houver uma tx no ctx, fn e executada direto sem abrir nova
//     transacao (evita aninhamento real e mantem rollback unificado);
//   - caso contrario, abre BeginTx(opts), injeta no ctx via txctx.With,
//     comita em sucesso e faz rollback em qualquer erro (inclusive panic).
func (m *Manager) RunInTx(ctx context.Context, opts pgx.TxOptions, fn func(ctx context.Context) error) (err error) {
	if _, ok := txctx.FromTx(ctx); ok {
		return fn(ctx)
	}

	tx, err := m.pool.BeginTx(ctx, opts)
	if err != nil {
		return fmt.Errorf("tx: begin: %w", err)
	}

	committed := false
	defer func() {
		if r := recover(); r != nil {
			_ = tx.Rollback(context.Background())
			panic(r)
		}
		if !committed {
			if rbErr := tx.Rollback(context.Background()); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
				m.log.Warn(ctx, "tx: rollback error", "err", rbErr.Error())
			}
		}
	}()

	if err := fn(txctx.With(ctx, tx)); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("tx: commit: %w", err)
	}
	committed = true
	return nil
}
