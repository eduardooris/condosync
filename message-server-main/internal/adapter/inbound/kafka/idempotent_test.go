package inboundkafka_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"testing"

	inboundkafka "github.com/IAtend-LOC/message-server/internal/adapter/inbound/kafka"
	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
)

// =============================================================================
// fakes
// =============================================================================

// fakeRecorder simula o outbox.Recorder. firstTime e o valor a devolver
// no proximo MarkProcessed; failWith permite simular falha do INSERT.
type fakeRecorder struct {
	firstTime bool
	failWith  error
	calls     int
	lastID    string
	lastTopic string
}

func (r *fakeRecorder) MarkProcessed(ctx context.Context, eventID, topic string) (bool, error) {
	r.calls++
	r.lastID = eventID
	r.lastTopic = topic
	if r.failWith != nil {
		return false, r.failWith
	}
	return r.firstTime, nil
}

// fakeRunner executa fn imediatamente -- equivalente ao caminho "ja existe
// tx no ctx" do TxManager real. Suficiente para isolar o decorator.
type fakeRunner struct {
	calls    int
	failWith error
}

func (r *fakeRunner) Run(ctx context.Context, fn func(ctx context.Context) error) error {
	r.calls++
	if r.failWith != nil {
		return r.failWith
	}
	return fn(ctx)
}

// recordingInner registra invocacoes do handler interno para os asserts.
type recordingInner struct {
	calls    int
	last     kafka.Record
	failWith error
}

func (r *recordingInner) handle(ctx context.Context, rec kafka.Record) error {
	r.calls++
	r.last = rec
	return r.failWith
}

func newSilentLogger() logger.Logger {
	return logger.NewWithWriter("error", io.Discard)
}

// =============================================================================
// IdempotentHandler -- comportamento end-to-end com fakes
// =============================================================================

func TestIdempotentHandler_PrimeiraEntregaChamaInner(t *testing.T) {
	t.Parallel()
	rec := kafka.Record{
		Topic:   "wpp.cmd.test.v1",
		Value:   []byte(`{}`),
		Headers: map[string][]byte{"event_id": []byte("evt-1")},
	}
	recorder := &fakeRecorder{firstTime: true}
	runner := &fakeRunner{}
	inner := &recordingInner{}

	h := inboundkafka.IdempotentHandler(recorder, runner, newSilentLogger(), nil, inner.handle)
	if err := h(context.Background(), rec); err != nil {
		t.Fatalf("handler retornou erro inesperado: %v", err)
	}

	if recorder.calls != 1 || recorder.lastID != "evt-1" || recorder.lastTopic != rec.Topic {
		t.Fatalf("recorder nao foi invocado corretamente: %+v", recorder)
	}
	if runner.calls != 1 {
		t.Fatalf("runner deveria ser chamado 1x, foi %d", runner.calls)
	}
	if inner.calls != 1 {
		t.Fatalf("inner deveria ser chamado 1x, foi %d", inner.calls)
	}
}

func TestIdempotentHandler_DuplicataNaoChamaInner(t *testing.T) {
	t.Parallel()
	rec := kafka.Record{
		Topic:   "wpp.cmd.test.v1",
		Value:   []byte(`{}`),
		Headers: map[string][]byte{"event_id": []byte("evt-dup")},
	}
	recorder := &fakeRecorder{firstTime: false} // conflito
	runner := &fakeRunner{}
	inner := &recordingInner{}

	h := inboundkafka.IdempotentHandler(recorder, runner, newSilentLogger(), nil, inner.handle)
	if err := h(context.Background(), rec); err != nil {
		t.Fatalf("duplicata nao deveria propagar erro: %v", err)
	}

	if inner.calls != 0 {
		t.Fatal("inner NAO pode ser chamado em duplicata")
	}
	if runner.calls != 1 {
		t.Fatalf("runner deveria abrir tx mesmo em duplicata, calls=%d", runner.calls)
	}
}

func TestIdempotentHandler_SemEventIDDescartaSemRetry(t *testing.T) {
	t.Parallel()
	rec := kafka.Record{Topic: "t", Value: []byte(`{}`)} // sem header, sem envelope
	recorder := &fakeRecorder{firstTime: true}
	runner := &fakeRunner{}
	inner := &recordingInner{}

	h := inboundkafka.IdempotentHandler(recorder, runner, newSilentLogger(), nil, inner.handle)
	if err := h(context.Background(), rec); err != nil {
		t.Fatalf("descartar mensagem mal-formada nao deveria propagar erro (vira loop), recebi %v", err)
	}

	if runner.calls != 0 || recorder.calls != 0 || inner.calls != 0 {
		t.Fatalf("nada pode ser invocado quando event_id ausente: runner=%d recorder=%d inner=%d",
			runner.calls, recorder.calls, inner.calls)
	}
}

func TestIdempotentHandler_FallbackEnvelopeEventID(t *testing.T) {
	t.Parallel()
	body, _ := json.Marshal(map[string]any{"event_id": "from-envelope"})
	rec := kafka.Record{Topic: "t", Value: body}
	recorder := &fakeRecorder{firstTime: true}
	runner := &fakeRunner{}
	inner := &recordingInner{}

	h := inboundkafka.IdempotentHandler(recorder, runner, newSilentLogger(), nil, inner.handle)
	if err := h(context.Background(), rec); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if recorder.lastID != "from-envelope" {
		t.Fatalf("event_id deveria vir do envelope, recebi %q", recorder.lastID)
	}
}

func TestIdempotentHandler_HeaderTemPrioridadeSobreEnvelope(t *testing.T) {
	t.Parallel()
	body, _ := json.Marshal(map[string]any{"event_id": "from-envelope"})
	rec := kafka.Record{
		Topic:   "t",
		Value:   body,
		Headers: map[string][]byte{"event_id": []byte("from-header")},
	}
	recorder := &fakeRecorder{firstTime: true}
	h := inboundkafka.IdempotentHandler(recorder, &fakeRunner{}, newSilentLogger(), nil,
		func(context.Context, kafka.Record) error { return nil })
	_ = h(context.Background(), rec)

	if recorder.lastID != "from-header" {
		t.Fatalf("header deve ter prioridade, recebi %q", recorder.lastID)
	}
}

func TestIdempotentHandler_ErroDoRecorderPropaga(t *testing.T) {
	t.Parallel()
	rec := kafka.Record{
		Topic:   "t",
		Value:   []byte(`{}`),
		Headers: map[string][]byte{"event_id": []byte("evt-1")},
	}
	recorder := &fakeRecorder{failWith: errors.New("db down")}
	runner := &fakeRunner{}
	inner := &recordingInner{}

	h := inboundkafka.IdempotentHandler(recorder, runner, newSilentLogger(), nil, inner.handle)
	err := h(context.Background(), rec)
	if err == nil {
		t.Fatal("esperava erro para reentrega; recebi nil")
	}
	if inner.calls != 0 {
		t.Fatal("inner NAO pode ser chamado quando recorder falha")
	}
}

func TestIdempotentHandler_ErroDoInnerPropaga(t *testing.T) {
	t.Parallel()
	rec := kafka.Record{
		Topic:   "t",
		Value:   []byte(`{}`),
		Headers: map[string][]byte{"event_id": []byte("evt-1")},
	}
	innerErr := errors.New("usecase failed")
	recorder := &fakeRecorder{firstTime: true}
	runner := &fakeRunner{}
	inner := &recordingInner{failWith: innerErr}

	h := inboundkafka.IdempotentHandler(recorder, runner, newSilentLogger(), nil, inner.handle)
	err := h(context.Background(), rec)
	if !errors.Is(err, innerErr) {
		t.Fatalf("esperava propagacao do erro do inner, recebi %v", err)
	}
}

func TestIdempotentHandler_HeaderVazioCaiNoEnvelope(t *testing.T) {
	t.Parallel()
	body, _ := json.Marshal(map[string]any{"event_id": "from-envelope"})
	rec := kafka.Record{
		Topic:   "t",
		Value:   body,
		Headers: map[string][]byte{"event_id": []byte("")}, // presente mas vazio
	}
	recorder := &fakeRecorder{firstTime: true}
	h := inboundkafka.IdempotentHandler(recorder, &fakeRunner{}, newSilentLogger(), nil,
		func(context.Context, kafka.Record) error { return nil })
	_ = h(context.Background(), rec)

	if recorder.lastID != "from-envelope" {
		t.Fatalf("header vazio deve cair no envelope, recebi %q", recorder.lastID)
	}
}
