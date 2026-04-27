package whatsmeowdriver

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/application/ports"
	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/domain/message"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/shared/id"

	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	waEvents "go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

// =============================================================================
// fakes locais (nao reusamos os do package usecase pra evitar import cycle)
// =============================================================================

type fakeRepo struct {
	mu               sync.Mutex
	findByIDOut      *instance.Instance
	updateStatusArgs []struct {
		id     id.ID
		status instance.Status
	}
	updateStatusErr error
	updateJIDArgs   []struct {
		id  id.ID
		jid string
	}
	updateJIDErr error
}

func (r *fakeRepo) Create(context.Context, *instance.Instance) error { return nil }
func (r *fakeRepo) FindByID(context.Context, id.ID) (*instance.Instance, error) {
	return r.findByIDOut, nil
}
func (r *fakeRepo) FindByCompany(context.Context, string) (*instance.Instance, error) {
	return nil, nil
}
func (r *fakeRepo) ListAll(context.Context) ([]*instance.Instance, error) { return nil, nil }
func (r *fakeRepo) UpdateStatus(_ context.Context, instID id.ID, st instance.Status) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.updateStatusArgs = append(r.updateStatusArgs, struct {
		id     id.ID
		status instance.Status
	}{instID, st})
	return r.updateStatusErr
}
func (r *fakeRepo) UpdateWhatsmeowJID(_ context.Context, instID id.ID, jid string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.updateJIDArgs = append(r.updateJIDArgs, struct {
		id  id.ID
		jid string
	}{instID, jid})
	return r.updateJIDErr
}
func (r *fakeRepo) Delete(context.Context, id.ID) error { return nil }

var _ instance.Repository = (*fakeRepo)(nil)

type fakePub struct {
	mu       sync.Mutex
	conn     []events.ConnectionUpdatedEvent
	qrEv     []events.QRCodeUpdatedEvent
	received []events.MessageReceivedEvent
	sent     []events.MessageSentEvent
	failConn bool
	failRecv bool
}

func (p *fakePub) PublishInstanceCreated(context.Context, events.InstanceCreatedEvent) error {
	return nil
}
func (p *fakePub) PublishQRCodeUpdated(_ context.Context, e events.QRCodeUpdatedEvent) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.qrEv = append(p.qrEv, e)
	return nil
}
func (p *fakePub) PublishConnectionUpdated(_ context.Context, e events.ConnectionUpdatedEvent) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.failConn {
		return errors.New("conn pub fail")
	}
	p.conn = append(p.conn, e)
	return nil
}
func (p *fakePub) PublishMessageReceived(_ context.Context, e events.MessageReceivedEvent) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.failRecv {
		return errors.New("recv pub fail")
	}
	p.received = append(p.received, e)
	return nil
}
func (p *fakePub) PublishMessageSent(_ context.Context, e events.MessageSentEvent) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.sent = append(p.sent, e)
	return nil
}

var _ ports.EventPublisher = (*fakePub)(nil)

type fakeRunner struct{}

func (fakeRunner) Run(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) }

type fakeMessageRepo struct {
	mu       sync.Mutex
	saved    []*message.Message
	inserted []bool
	idx      int
	saveErr  error
}

func (r *fakeMessageRepo) Save(_ context.Context, m *message.Message) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
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
func (r *fakeMessageRepo) ExistsByWppID(context.Context, id.ID, string, message.Direction) (bool, error) {
	return false, nil
}

var _ message.Repository = (*fakeMessageRepo)(nil)

type fakeJIDs struct{ user, server string }

func (f fakeJIDs) JIDOf(id.ID) (string, string, bool) {
	if f.user == "" {
		return "", "", false
	}
	return f.user, f.server, true
}

// =============================================================================
// helpers
// =============================================================================

// hydratedInstance e a instance default usada pelos testes para o
// FindByID do fakeRepo. Necessario apos Dispatch passar a resolver
// tenant_id antes de delegar (descarta evento se instance ausente).
func hydratedInstance(instID id.ID) *instance.Instance {
	return instance.Hydrate(instID, "company-test", "n", instance.StatusConnected, "",
		time.Now().UTC(), time.Now().UTC())
}

func newDispatcher(repo *fakeRepo, pub *fakePub, ingest *usecase.IngestIncomingMessage, jids jidResolver) *Dispatcher {
	if repo.findByIDOut == nil {
		repo.findByIDOut = hydratedInstance("inst-1")
	}
	return NewDispatcher(repo, pub, ingest, jids, logger.New("error"), nil)
}

// =============================================================================
// tests
// =============================================================================

func TestDispatcher_Connected(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	pub := &fakePub{}
	d := newDispatcher(repo, pub, nil, nil)

	d.Dispatch(context.Background(), "inst-1", &waEvents.Connected{})

	if len(repo.updateStatusArgs) != 1 || repo.updateStatusArgs[0].status != instance.StatusConnected {
		t.Fatalf("status nao atualizado para CONNECTED: %+v", repo.updateStatusArgs)
	}
	if len(pub.conn) != 1 || pub.conn[0].Status != "CONNECTED" {
		t.Fatalf("evento conn nao publicado: %+v", pub.conn)
	}
}

func TestDispatcher_Disconnected(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	pub := &fakePub{}
	d := newDispatcher(repo, pub, nil, nil)

	d.Dispatch(context.Background(), "inst-1", &waEvents.Disconnected{})

	if len(repo.updateStatusArgs) != 1 || repo.updateStatusArgs[0].status != instance.StatusDisconnected {
		t.Fatalf("status nao atualizado: %+v", repo.updateStatusArgs)
	}
	if len(pub.conn) != 1 || pub.conn[0].Status != "DISCONNECTED" {
		t.Fatalf("evento conn nao publicado: %+v", pub.conn)
	}
}

func TestDispatcher_LoggedOut(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	pub := &fakePub{}
	d := newDispatcher(repo, pub, nil, nil)

	d.Dispatch(context.Background(), "inst-1", &waEvents.LoggedOut{Reason: waEvents.ConnectFailureLoggedOut})

	if len(repo.updateStatusArgs) != 1 || repo.updateStatusArgs[0].status != instance.StatusLoggedOut {
		t.Fatalf("status nao atualizado: %+v", repo.updateStatusArgs)
	}
	if len(pub.conn) != 1 || pub.conn[0].Status != "LOGGED_OUT" || pub.conn[0].Reason == "" {
		t.Fatalf("evento logout invalido: %+v", pub.conn)
	}
}

func TestDispatcher_PairSuccess(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	pub := &fakePub{}
	d := newDispatcher(repo, pub, nil, nil)

	jid := types.NewJID("5511999999999", types.DefaultUserServer)
	d.Dispatch(context.Background(), "inst-1", &waEvents.PairSuccess{ID: jid})

	if len(repo.updateJIDArgs) != 1 {
		t.Fatalf("UpdateWhatsmeowJID nao chamado: %+v", repo.updateJIDArgs)
	}
	if repo.updateJIDArgs[0].jid == "" {
		t.Fatalf("JID vazio")
	}
	if len(repo.updateStatusArgs) != 1 || repo.updateStatusArgs[0].status != instance.StatusConnecting {
		t.Fatalf("status nao foi para CONNECTING apos pair: %+v", repo.updateStatusArgs)
	}
}

func TestDispatcher_Message_TextoIngerido(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	pub := &fakePub{}
	mrepo := &fakeMessageRepo{inserted: []bool{true}}
	ingest := usecase.NewIngestIncomingMessage(fakeRunner{}, mrepo, pub)
	d := newDispatcher(repo, pub, ingest, fakeJIDs{user: "5511000000000", server: types.DefaultUserServer})

	from := types.NewJID("5511999999999", types.DefaultUserServer)
	d.Dispatch(context.Background(), "inst-1", &waEvents.Message{
		Info: types.MessageInfo{
			MessageSource: types.MessageSource{
				Sender: from,
				Chat:   from,
			},
			ID:        "WPP-1",
			Timestamp: time.Now().UTC(),
		},
		Message: &waProto.Message{Conversation: proto.String("ola mundo")},
	})

	if len(mrepo.saved) != 1 {
		t.Fatalf("mensagem nao persistida: %+v", mrepo.saved)
	}
	if len(pub.received) != 1 || pub.received[0].Body != "ola mundo" {
		t.Fatalf("evento received invalido: %+v", pub.received)
	}
}

func TestDispatcher_Message_FromMeNaoPublica(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	pub := &fakePub{}
	mrepo := &fakeMessageRepo{inserted: []bool{true}}
	ingest := usecase.NewIngestIncomingMessage(fakeRunner{}, mrepo, pub)
	d := newDispatcher(repo, pub, ingest, fakeJIDs{user: "5511000000000", server: types.DefaultUserServer})

	from := types.NewJID("5511000000000", types.DefaultUserServer)
	d.Dispatch(context.Background(), "inst-1", &waEvents.Message{
		Info: types.MessageInfo{
			MessageSource: types.MessageSource{
				Sender:   from,
				Chat:     from,
				IsFromMe: true,
			},
			ID:        "WPP-2",
			Timestamp: time.Now().UTC(),
		},
		Message: &waProto.Message{Conversation: proto.String("echo")},
	})

	if len(mrepo.saved) != 1 {
		t.Fatalf("mensagem fromMe nao persistida: %+v", mrepo.saved)
	}
	if len(pub.received) != 0 {
		t.Fatalf("fromMe NAO deveria publicar: %+v", pub.received)
	}
}

func TestDispatcher_Message_TipoNaoSuportadoSilencioso(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	pub := &fakePub{}
	mrepo := &fakeMessageRepo{}
	ingest := usecase.NewIngestIncomingMessage(fakeRunner{}, mrepo, pub)
	d := newDispatcher(repo, pub, ingest, nil)

	from := types.NewJID("5511999999999", types.DefaultUserServer)
	d.Dispatch(context.Background(), "inst-1", &waEvents.Message{
		Info: types.MessageInfo{
			MessageSource: types.MessageSource{Sender: from, Chat: from},
			ID:            "WPP-3",
			Timestamp:     time.Now().UTC(),
		},
		Message: &waProto.Message{}, // sem Conversation nem ExtendedText
	})

	if len(mrepo.saved) != 0 {
		t.Fatalf("nao deveria ingestir tipo sem texto: %+v", mrepo.saved)
	}
}

func TestDispatcher_PanicEhContido(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{}
	pub := &fakePub{failConn: true} // Publish vai erro, mas ainda nao panica
	d := newDispatcher(repo, pub, nil, nil)

	// envia evento que vai disparar Publish que erra; nao deve panicar.
	d.Dispatch(context.Background(), "inst-1", &waEvents.Connected{})
	// nao deve atingir aqui via panic; sucesso = nada lancado.
}
