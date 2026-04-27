package txctx_test

import (
	"context"
	"testing"

	"github.com/IAtend-LOC/message-server/internal/platform/postgres"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/txctx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// fakeQuerier serve apenas como sentinela para identidade de ponteiro:
// queremos provar que From devolve EXATAMENTE o fallback quando nao ha
// tx no ctx. Os metodos nunca sao chamados.
type fakeQuerier struct{ id string }

func (f *fakeQuerier) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (f *fakeQuerier) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}
func (f *fakeQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

// fakeTx satisfaz pgx.Tx parcialmente: precisamos apenas de algo
// distinto de nil para o ctx carregar.
type fakeTx struct{ pgx.Tx }

func TestFrom_FallbackQuandoCtxSemTx(t *testing.T) {
	t.Parallel()
	fallback := &fakeQuerier{id: "pool"}
	got := txctx.From(context.Background(), fallback)
	if got != postgres.Querier(fallback) {
		t.Fatalf("esperava receber o fallback, recebi %#v", got)
	}
}

func TestFrom_DevolveTxQuandoCtxContemTx(t *testing.T) {
	t.Parallel()
	fallback := &fakeQuerier{id: "pool"}
	tx := &fakeTx{}
	ctx := txctx.With(context.Background(), tx)
	got := txctx.From(ctx, fallback)
	if got == postgres.Querier(fallback) {
		t.Fatalf("esperava a tx do ctx, recebi o fallback")
	}
	if _, ok := got.(*fakeTx); !ok {
		t.Fatalf("esperava *fakeTx, recebi %T", got)
	}
}

func TestFromTx_PresencaIndicaTx(t *testing.T) {
	t.Parallel()
	if _, ok := txctx.FromTx(context.Background()); ok {
		t.Fatal("ctx vazio nao deveria conter tx")
	}
	tx := &fakeTx{}
	if got, ok := txctx.FromTx(txctx.With(context.Background(), tx)); !ok || got != tx {
		t.Fatalf("FromTx deveria devolver a tx injetada (ok=%v got=%#v)", ok, got)
	}
}
