package kafkasink_test

import (
	"context"
	"errors"
	"testing"

	"github.com/IAtend-LOC/message-server/internal/adapter/outbound/kafkasink"
	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
)

// fakeProducer satisfaz kafka.Producer apenas para o que o Sink consome.
type fakeProducer struct {
	produced []kafka.Record
	closed   int
	failWith error
}

func (p *fakeProducer) Produce(ctx context.Context, r kafka.Record) error {
	p.produced = append(p.produced, r)
	return p.failWith
}

func (p *fakeProducer) Close() error {
	p.closed++
	return nil
}

var _ kafka.Producer = (*fakeProducer)(nil)

func TestSink_ProduceDelegaAoProducer(t *testing.T) {
	t.Parallel()
	p := &fakeProducer{}
	s := kafkasink.New(p)

	rec := kafka.Record{
		Topic:   "wpp.evt.x.v1",
		Key:     []byte("k"),
		Value:   []byte(`{"a":1}`),
		Headers: map[string][]byte{"event_id": []byte("evt-1")},
	}
	if err := s.Produce(context.Background(), rec); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if len(p.produced) != 1 {
		t.Fatalf("producer deveria receber 1 record, recebeu %d", len(p.produced))
	}
	got := p.produced[0]
	if got.Topic != rec.Topic || string(got.Key) != "k" || string(got.Value) != `{"a":1}` {
		t.Fatalf("record corrompido: %#v", got)
	}
	if string(got.Headers["event_id"]) != "evt-1" {
		t.Fatalf("headers nao preservados: %#v", got.Headers)
	}
}

func TestSink_ProduceErroPropaga(t *testing.T) {
	t.Parallel()
	want := errors.New("broker down")
	s := kafkasink.New(&fakeProducer{failWith: want})
	if got := s.Produce(context.Background(), kafka.Record{Topic: "t"}); !errors.Is(got, want) {
		t.Fatalf("esperava propagacao de %v, recebi %v", want, got)
	}
}

func TestSink_NaoFechaProducer(t *testing.T) {
	t.Parallel()
	// Sink NAO deve gerenciar ciclo de vida do producer (bootstrap faz isso).
	// Garantia compilada: Sink nao expoe Close.
	p := &fakeProducer{}
	s := kafkasink.New(p)
	_ = s
	if p.closed != 0 {
		t.Fatalf("Sink nao deve fechar o producer (closed=%d)", p.closed)
	}
}
