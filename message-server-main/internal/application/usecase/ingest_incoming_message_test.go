package usecase_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/domain/message"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// =============================================================================
// fake message repository -- inserted controla retorno de Save por chamada.
// =============================================================================

type fakeMsgRepo struct {
	saved    []*message.Message
	inserted []bool
	idx      int
	saveErr  error
}

func (r *fakeMsgRepo) Save(_ context.Context, m *message.Message) (bool, error) {
	if r.saveErr != nil {
		return false, r.saveErr
	}
	r.saved = append(r.saved, m)
	if r.idx < len(r.inserted) {
		out := r.inserted[r.idx]
		r.idx++
		return out, nil
	}
	return true, nil
}
func (r *fakeMsgRepo) ExistsByWppID(context.Context, id.ID, string, message.Direction) (bool, error) {
	return false, nil
}

var _ message.Repository = (*fakeMsgRepo)(nil)

// =============================================================================
// tests
// =============================================================================

func cmdValid() usecase.IngestIncomingMessageCommand {
	return usecase.IngestIncomingMessageCommand{
		InstanceID: "inst-1",
		WppID:      "WPP-1",
		From:       "5511999999999@s.whatsapp.net",
		To:         "5511000000000@s.whatsapp.net",
		Body:       "ola",
		Timestamp:  time.Now().UTC(),
		FromMe:     false,
	}
}

func TestIngestIncomingMessage_PersisteEPublica(t *testing.T) {
	t.Parallel()
	repo := &fakeMsgRepo{inserted: []bool{true}}
	pub := &fakePublisher{}
	uc := usecase.NewIngestIncomingMessage(&fakeRunner{}, repo, pub)

	if err := uc.Execute(context.Background(), cmdValid()); err != nil {
		t.Fatalf("err inesperado: %v", err)
	}
	if len(repo.saved) != 1 {
		t.Fatalf("nao persistiu: %+v", repo.saved)
	}
	if len(pub.messageReceived) != 1 {
		t.Fatalf("evento nao publicado: %+v", pub.messageReceived)
	}
	if pub.messageReceived[0].WppID != "WPP-1" {
		t.Fatalf("wpp_id divergente: %+v", pub.messageReceived[0])
	}
}

func TestIngestIncomingMessage_IdempotenteNaoPublica(t *testing.T) {
	t.Parallel()
	// segunda chamada -> inserted=false (UNIQUE conflict).
	repo := &fakeMsgRepo{inserted: []bool{true, false}}
	pub := &fakePublisher{}
	uc := usecase.NewIngestIncomingMessage(&fakeRunner{}, repo, pub)

	cmd := cmdValid()
	if err := uc.Execute(context.Background(), cmd); err != nil {
		t.Fatalf("1a chamada: %v", err)
	}
	if err := uc.Execute(context.Background(), cmd); err != nil {
		t.Fatalf("2a chamada: %v", err)
	}
	if len(pub.messageReceived) != 1 {
		t.Fatalf("evento publicado %d vezes (esperava 1): %+v", len(pub.messageReceived), pub.messageReceived)
	}
}

func TestIngestIncomingMessage_FromMePersisteNaoPublica(t *testing.T) {
	t.Parallel()
	repo := &fakeMsgRepo{inserted: []bool{true}}
	pub := &fakePublisher{}
	uc := usecase.NewIngestIncomingMessage(&fakeRunner{}, repo, pub)

	cmd := cmdValid()
	cmd.FromMe = true
	if err := uc.Execute(context.Background(), cmd); err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(repo.saved) != 1 {
		t.Fatalf("deveria persistir fromMe: %+v", repo.saved)
	}
	if repo.saved[0].Direction() != message.DirectionOutbound {
		t.Fatalf("direcao errada: %s", repo.saved[0].Direction())
	}
	if len(pub.messageReceived) != 0 {
		t.Fatalf("fromMe NAO deveria publicar: %+v", pub.messageReceived)
	}
}

func TestIngestIncomingMessage_BodyVazioErroValidacao(t *testing.T) {
	t.Parallel()
	repo := &fakeMsgRepo{}
	pub := &fakePublisher{}
	uc := usecase.NewIngestIncomingMessage(&fakeRunner{}, repo, pub)

	cmd := cmdValid()
	cmd.Body = ""
	err := uc.Execute(context.Background(), cmd)
	if err == nil {
		t.Fatalf("esperava erro de validacao")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Kind != errs.KindValidation {
		t.Fatalf("erro errado: %v", err)
	}
	if len(repo.saved) != 0 || len(pub.messageReceived) != 0 {
		t.Fatalf("nao deveria persistir nem publicar")
	}
}

func TestIngestIncomingMessage_SaveErroVazaInternal(t *testing.T) {
	t.Parallel()
	repo := &fakeMsgRepo{saveErr: errors.New("db down")}
	pub := &fakePublisher{}
	uc := usecase.NewIngestIncomingMessage(&fakeRunner{}, repo, pub)

	err := uc.Execute(context.Background(), cmdValid())
	if err == nil {
		t.Fatalf("esperava erro")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Code != "MESSAGE_PERSIST_FAILED" {
		t.Fatalf("erro errado: %v", err)
	}
}

func TestIngestIncomingMessage_PublishErroVazaInternal(t *testing.T) {
	t.Parallel()
	repo := &fakeMsgRepo{inserted: []bool{true}}
	pub := &fakePublisher{failOn: "message.received", failWith: errSentinel}
	uc := usecase.NewIngestIncomingMessage(&fakeRunner{}, repo, pub)

	err := uc.Execute(context.Background(), cmdValid())
	if err == nil {
		t.Fatalf("esperava erro")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Code != "EVENT_ENQUEUE_FAILED" {
		t.Fatalf("erro errado: %v", err)
	}
}
