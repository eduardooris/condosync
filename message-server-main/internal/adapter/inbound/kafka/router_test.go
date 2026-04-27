package inboundkafka_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	inboundkafka "github.com/IAtend-LOC/message-server/internal/adapter/inbound/kafka"
	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/config"
	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
)

// fakeConsumer captura os topicos e handlers registrados pelo Router.
// Nao roda polling -- o teste invoca os handlers diretamente.
type fakeConsumer struct {
	subs map[string]kafka.Handler
}

func newFakeConsumer() *fakeConsumer { return &fakeConsumer{subs: map[string]kafka.Handler{}} }

func (c *fakeConsumer) Subscribe(topic string, h kafka.Handler) { c.subs[topic] = h }
func (c *fakeConsumer) Run(ctx context.Context) error           { <-ctx.Done(); return nil }
func (c *fakeConsumer) Close() error                            { return nil }

var _ kafka.Consumer = (*fakeConsumer)(nil)

func makeTopics() config.KafkaTopics {
	return config.KafkaTopics{
		CmdInstanceCreate:  "wpp.cmd.instance.create.v1",
		CmdInstanceDelete:  "wpp.cmd.instance.delete.v1",
		CmdMessageSendText: "wpp.cmd.message.send-text.v1",
	}
}

// TestRouter_RegisterAplicaDecoratorEmTodosOsHandlers garante que
// NENHUM handler e registrado sem o IdempotentHandler. A prova
// observavel: ao publicar um record SEM event_id, o handler deve
// ser silenciosamente descartado (decorator devolve nil sem chamar
// o caso de uso, evitando NPE no UC nil).
func TestRouter_RegisterAplicaDecoratorEmTodosOsHandlers(t *testing.T) {
	t.Parallel()
	c := newFakeConsumer()

	// UCs nil aqui sao seguros porque o decorator descarta o record antes
	// de delegar -- justamente o que queremos provar.
	r := inboundkafka.New(newSilentLogger(), makeTopics(), nil, nil, nil)
	r.Register(c, &fakeRecorder{firstTime: true}, &fakeRunner{}, nil)

	wantTopics := []string{
		"wpp.cmd.instance.create.v1",
		"wpp.cmd.message.send-text.v1",
	}
	for _, topic := range wantTopics {
		h, ok := c.subs[topic]
		if !ok {
			t.Fatalf("handler nao registrado para %s", topic)
		}
		// Record sem event_id -> decorator descarta -> retorno nil sem
		// dereferenciar o UC nil.
		err := h(context.Background(), kafka.Record{Topic: topic, Value: []byte(`{}`)})
		if err != nil {
			t.Fatalf("decorator nao envolveu %s (record mal-formado deveria retornar nil): %v", topic, err)
		}
	}
}

// TestRouter_HandlerCreateInstancePropagaErroDeUnmarshal cobre o
// caminho onde o envelope JSON e invalido. Usamos firstTime=true e
// runner que delega para que o handler interno seja efetivamente
// invocado e tenha chance de falhar no Unmarshal.
func TestRouter_HandlerCreateInstancePropagaErroDeUnmarshal(t *testing.T) {
	t.Parallel()
	c := newFakeConsumer()
	r := inboundkafka.New(newSilentLogger(), makeTopics(), nil, nil, nil)
	r.Register(c, &fakeRecorder{firstTime: true}, &fakeRunner{}, nil)

	rec := kafka.Record{
		Topic:   "wpp.cmd.instance.create.v1",
		Value:   []byte(`not-a-json`),
		Headers: map[string][]byte{"event_id": []byte("evt-1")},
	}
	err := c.subs[rec.Topic](context.Background(), rec)
	if err == nil {
		t.Fatal("esperava erro de unmarshal")
	}
	var syntaxErr *json.SyntaxError
	if !errors.As(err, &syntaxErr) {
		t.Fatalf("esperava json.SyntaxError, recebi %T (%v)", err, err)
	}
}

// TestRouter_DuplicataNaoPropagaParaUC garante que reentregas com
// mesmo event_id nao chegam ate os UCs (que nao foram fornecidos
// neste teste -- nil panics seriam imediatos se o decorator falhasse).
func TestRouter_DuplicataNaoPropagaParaUC(t *testing.T) {
	t.Parallel()
	c := newFakeConsumer()
	r := inboundkafka.New(newSilentLogger(), makeTopics(), nil, nil, nil)
	r.Register(c, &fakeRecorder{firstTime: false}, &fakeRunner{}, nil)

	body, _ := json.Marshal(events.EventEnvelope[events.CreateInstanceCommand]{
		EventID: "evt-dup",
		Payload: events.CreateInstanceCommand{CompanyID: "c", Name: "x"},
	})
	rec := kafka.Record{
		Topic:   "wpp.cmd.instance.create.v1",
		Value:   body,
		Headers: map[string][]byte{"event_id": []byte("evt-dup")},
	}
	if err := c.subs[rec.Topic](context.Background(), rec); err != nil {
		t.Fatalf("duplicata nao deveria erro: %v", err)
	}
}
