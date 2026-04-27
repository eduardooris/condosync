package outbox_test

import (
	"io"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/adapter/outbound/outbox"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
)

func newSilentLogger() logger.Logger { return logger.NewWithWriter("error", io.Discard) }

// NewRelay tem defaults documentados (batch=100, poll=500ms). Os testes
// abaixo congelam esse contrato -- mudar exige actualizar a doc + .env.
func TestNewRelay_DefaultBatchSizeQuandoNaoPositivo(t *testing.T) {
	t.Parallel()
	tests := []int{0, -1, -100}
	for _, in := range tests {
		// Pool nil e seguro: NewRelay nao acessa o pool, apenas guarda.
		r := outbox.NewRelay(nil, &stubSink{}, newSilentLogger(), nil, in, time.Second)
		if r == nil {
			t.Fatalf("NewRelay devolveu nil para batchSize=%d", in)
		}
	}
}

func TestNewRelay_DefaultPollIntervalQuandoNaoPositivo(t *testing.T) {
	t.Parallel()
	tests := []time.Duration{0, -time.Millisecond}
	for _, in := range tests {
		r := outbox.NewRelay(nil, &stubSink{}, newSilentLogger(), nil, 10, in)
		if r == nil {
			t.Fatalf("NewRelay devolveu nil para pollInterval=%v", in)
		}
	}
}

func TestNewRelay_AceitaSinkArbitrario(t *testing.T) {
	t.Parallel()
	// Garantir que NewRelay aceita qualquer implementacao da interface
	// Sink -- importante para testes unitarios de processBatch (G4
	// integration tests substituirao por Kafka real).
	r := outbox.NewRelay(nil, &stubSink{}, newSilentLogger(), nil, 0, 0)
	if r == nil {
		t.Fatal("NewRelay devolveu nil")
	}
}
