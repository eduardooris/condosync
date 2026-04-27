package usecase_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// hydratedInstance constroi uma Instance ja com status arbitrario via
// instance.Hydrate -- evita poluir os testes com transicoes manuais.
func hydratedInstance(t *testing.T, status instance.Status) *instance.Instance {
	t.Helper()
	now := time.Now().UTC()
	return instance.Hydrate(id.New(), "comp-1", "default", status, "", now, now)
}

func newSendUC(
	runner *fakeRunner,
	repo *fakeInstanceRepo,
	driver *fakeDriver,
	pub *fakePublisher,
) *usecase.SendTextMessage {
	return usecase.NewSendTextMessage(runner, repo, driver, pub)
}

func TestSendTextMessage_HappyPath(t *testing.T) {
	t.Parallel()
	inst := hydratedInstance(t, instance.StatusConnected)
	runner := &fakeRunner{}
	repo := &fakeInstanceRepo{findByIDOut: inst}
	driver := &fakeDriver{sendOut: "wpp-msg-1"}
	pub := &fakePublisher{}

	out, err := newSendUC(runner, repo, driver, pub).Execute(
		context.Background(),
		usecase.SendTextMessageCommand{InstanceID: inst.ID(), To: "5511", Body: "oi"},
	)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if out.WppMessageID != "wpp-msg-1" {
		t.Fatalf("WppMessageID inesperado: %q", out.WppMessageID)
	}
	if driver.sendCalls != 1 {
		t.Fatalf("driver.SendText deveria ser chamado 1x, foi %d", driver.sendCalls)
	}
	if driver.sendArgs.to != "5511" || driver.sendArgs.body != "oi" {
		t.Fatalf("args do driver corrompidos: %+v", driver.sendArgs)
	}
	if runner.calls != 1 {
		t.Fatalf("runner deveria abrir tx 1x apos SendText, foi %d", runner.calls)
	}
	if len(pub.messageSent) != 1 {
		t.Fatalf("MessageSent nao publicado: %d", len(pub.messageSent))
	}
	got := pub.messageSent[0]
	if got.WppID != "wpp-msg-1" || got.InstanceID != inst.ID() || got.To != "5511" || got.Body != "oi" {
		t.Fatalf("payload do evento incorreto: %+v", got)
	}
}

func TestSendTextMessage_InstanciaNaoEncontrada(t *testing.T) {
	t.Parallel()
	runner := &fakeRunner{}
	driver := &fakeDriver{}
	pub := &fakePublisher{}

	_, err := newSendUC(runner, &fakeInstanceRepo{findByIDOut: nil}, driver, pub).
		Execute(context.Background(), usecase.SendTextMessageCommand{InstanceID: "x"})
	if err == nil {
		t.Fatal("esperava erro")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Kind != errs.KindNotFound || de.Code != "INSTANCE_NOT_FOUND" {
		t.Fatalf("erro inesperado: %v", err)
	}
	if driver.sendCalls != 0 || runner.calls != 0 {
		t.Fatal("nada pode ser invocado quando instancia nao existe")
	}
}

func TestSendTextMessage_RepoDevolveErroPropagaSemEnvelopar(t *testing.T) {
	t.Parallel()
	repoErr := errors.New("db down")
	_, err := newSendUC(&fakeRunner{},
		&fakeInstanceRepo{findByIDErr: repoErr},
		&fakeDriver{}, &fakePublisher{},
	).Execute(context.Background(), usecase.SendTextMessageCommand{InstanceID: "x"})
	if !errors.Is(err, repoErr) {
		t.Fatalf("erro do repo deve propagar via errors.Is, recebi %v", err)
	}
}

func TestSendTextMessage_InstanciaNaoConectada(t *testing.T) {
	t.Parallel()
	tests := []instance.Status{
		instance.StatusPending,
		instance.StatusConnecting,
		instance.StatusDisconnected,
		instance.StatusLoggedOut,
	}
	for _, st := range tests {
		st := st
		t.Run(string(st), func(t *testing.T) {
			t.Parallel()
			inst := hydratedInstance(t, st)
			runner := &fakeRunner{}
			driver := &fakeDriver{}
			_, err := newSendUC(runner, &fakeInstanceRepo{findByIDOut: inst}, driver, &fakePublisher{}).
				Execute(context.Background(), usecase.SendTextMessageCommand{InstanceID: inst.ID()})
			var de *errs.Error
			if !errors.As(err, &de) || de.Code != "INSTANCE_NOT_CONNECTED" {
				t.Fatalf("esperava INSTANCE_NOT_CONNECTED, recebi %v", err)
			}
			if driver.sendCalls != 0 || runner.calls != 0 {
				t.Fatal("status invalido nao pode disparar SendText nem tx")
			}
		})
	}
}

func TestSendTextMessage_FalhaDoDriverEhUnavailable(t *testing.T) {
	t.Parallel()
	inst := hydratedInstance(t, instance.StatusConnected)
	driver := &fakeDriver{sendErr: errSentinel}
	runner := &fakeRunner{}
	pub := &fakePublisher{}

	_, err := newSendUC(runner, &fakeInstanceRepo{findByIDOut: inst}, driver, pub).
		Execute(context.Background(), usecase.SendTextMessageCommand{InstanceID: inst.ID()})
	var de *errs.Error
	if !errors.As(err, &de) || de.Kind != errs.KindUnavailable || de.Code != "MESSAGE_SEND_FAILED" {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !errors.Is(err, errSentinel) {
		t.Fatal("causa original deve estar em errors.Is")
	}
	if runner.calls != 0 || len(pub.messageSent) != 0 {
		t.Fatal("falha do driver nao pode abrir tx nem publicar evento")
	}
}

func TestSendTextMessage_FalhaPublisherDevolveWppIDComErro(t *testing.T) {
	t.Parallel()
	// Cenario critico: WhatsApp ja entregou a mensagem, mas o outbox
	// falhou. O caller (router) precisa do wppID para idempotencia
	// futura, mas tambem precisa propagar o erro para reentrega.
	inst := hydratedInstance(t, instance.StatusConnected)
	runner := &fakeRunner{}
	driver := &fakeDriver{sendOut: "wpp-msg-99"}
	pub := &fakePublisher{failOn: "message.sent", failWith: errSentinel}

	out, err := newSendUC(runner, &fakeInstanceRepo{findByIDOut: inst}, driver, pub).
		Execute(context.Background(), usecase.SendTextMessageCommand{InstanceID: inst.ID()})
	if err == nil {
		t.Fatal("esperava erro")
	}
	if out.WppMessageID != "wpp-msg-99" {
		t.Fatalf("WppMessageID deve ser preservado mesmo com erro, recebi %q", out.WppMessageID)
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Code != "EVENT_ENQUEUE_FAILED" {
		t.Fatalf("esperava EVENT_ENQUEUE_FAILED, recebi %v", err)
	}
}

func TestSendTextMessage_FalhaInfraNoRunnerEhEnvelopadaComoInternal(t *testing.T) {
	t.Parallel()
	inst := hydratedInstance(t, instance.StatusConnected)
	runner := &fakeRunner{failWith: errSentinel}
	driver := &fakeDriver{sendOut: "wpp-msg-1"}

	out, err := newSendUC(runner, &fakeInstanceRepo{findByIDOut: inst}, driver, &fakePublisher{}).
		Execute(context.Background(), usecase.SendTextMessageCommand{InstanceID: inst.ID()})
	if err == nil {
		t.Fatal("esperava erro")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Code != "EVENT_ENQUEUE_FAILED" || de.Kind != errs.KindInternal {
		t.Fatalf("erro inesperado: %v", err)
	}
	if out.WppMessageID != "wpp-msg-1" {
		t.Fatal("WppMessageID deve ser preservado mesmo em erro de infra")
	}
}
