package tx_test

import (
	"context"
	"errors"
	"io"
	"testing"

	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/tx"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/txctx"
	pgx "github.com/jackc/pgx/v5"
)

// fakeTx e um stub minimo de pgx.Tx -- so precisa existir como ponteiro
// para o txctx carregar; nenhum metodo e invocado neste branch (ja ha
// uma tx no ctx, entao Manager.Run pula BeginTx por completo).
type fakeTx struct{ pgx.Tx }

func newSilentLogger() logger.Logger {
	return logger.NewWithWriter("error", io.Discard)
}

// TestManager_Run_TxJaNoCtxReusa cobre o branch que NAO toca o pool:
// quando o ctx ja contem uma tx (caso do IdempotentHandler envolvendo
// um UC que tambem chama Run), o Manager apenas executa fn -- sem
// abrir nova tx, sem aninhamento real. Este teste garante que o
// reuso e silencioso (nada e committado/rollbackado pelo wrapper).
func TestManager_Run_TxJaNoCtxReusa(t *testing.T) {
	t.Parallel()
	// Pool nil de proposito: prova que o branch nao chama BeginTx.
	m := tx.NewManager(nil, newSilentLogger())

	ctx := txctx.With(context.Background(), &fakeTx{})

	called := 0
	err := m.Run(ctx, func(inner context.Context) error {
		called++
		// A mesma tx deve continuar exposta no ctx interno.
		if _, ok := txctx.FromTx(inner); !ok {
			t.Error("tx do ctx pai deveria estar visivel ao fn")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if called != 1 {
		t.Fatalf("fn deveria executar 1x, foi %d", called)
	}
}

// TestManager_Run_PropagaErroDoFn garante que o reuso preserva o erro.
func TestManager_Run_PropagaErroDoFn(t *testing.T) {
	t.Parallel()
	m := tx.NewManager(nil, newSilentLogger())
	ctx := txctx.With(context.Background(), &fakeTx{})

	want := errors.New("falha de negocio")
	got := m.Run(ctx, func(context.Context) error { return want })
	if !errors.Is(got, want) {
		t.Fatalf("esperava %v, recebi %v", want, got)
	}
}

// TestManager_RunInTx_TxJaNoCtxReusa cobre o mesmo branch via API
// completa (RunInTx) -- garante que ambas as portas tem o mesmo
// comportamento de reuso.
func TestManager_RunInTx_TxJaNoCtxReusa(t *testing.T) {
	t.Parallel()
	m := tx.NewManager(nil, newSilentLogger())
	ctx := txctx.With(context.Background(), &fakeTx{})

	called := 0
	err := m.RunInTx(ctx, pgx.TxOptions{}, func(context.Context) error {
		called++
		return nil
	})
	if err != nil || called != 1 {
		t.Fatalf("reuso falhou: err=%v called=%d", err, called)
	}
}
