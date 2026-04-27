package outbox_test

import (
	"context"
	"errors"
	"testing"

	"github.com/IAtend-LOC/message-server/internal/adapter/outbound/outbox"
	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
)

type stubSink struct {
	calls    int
	failWith error
	last     kafka.Record
}

func (s *stubSink) Produce(ctx context.Context, r kafka.Record) error {
	s.calls++
	s.last = r
	return s.failWith
}

// O sink interface declara apenas Produce, ja exigido aqui.
var _ outbox.Sink = (*stubSink)(nil)

// Smoke de tipo: queremos provar que stubSink satisfaz a Sink declarada
// pelo pacote, garantindo que mocks de teste continuam compilando se a
// interface evoluir.
func TestStubSink_ImplementaSinkInterface(t *testing.T) {
	t.Parallel()
	var s outbox.Sink = &stubSink{}
	if err := s.Produce(context.Background(), kafka.Record{Topic: "t"}); err != nil {
		t.Fatalf("produce inesperado: %v", err)
	}
}

// TestStubSink_PropagaErro garante que erros do sink chegam ao chamador
// sem mascaramento (relay vai depender disso para incrementar attempts).
func TestStubSink_PropagaErro(t *testing.T) {
	t.Parallel()
	want := errors.New("kafka indisponivel")
	s := &stubSink{failWith: want}
	if got := s.Produce(context.Background(), kafka.Record{Topic: "t"}); !errors.Is(got, want) {
		t.Fatalf("esperava %v, recebi %v", want, got)
	}
}
