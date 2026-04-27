// fakes_test.go: dubles compartilhados pelos testes dos casos de uso.
//
// Reutilizamos um unico conjunto de fakes (TxRunner, Repository, Driver,
// EventPublisher) entre create_instance_test.go e send_text_message_test.go
// para nao duplicar boilerplate.
package usecase_test

import (
	"context"
	"errors"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/application/ports"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// =============================================================================
// fakeRunner -- ports.TxRunner
// =============================================================================

type fakeRunner struct {
	calls    int
	failWith error // se !=nil, NAO chama fn (simula erro de BeginTx)
}

func (r *fakeRunner) Run(ctx context.Context, fn func(ctx context.Context) error) error {
	r.calls++
	if r.failWith != nil {
		return r.failWith
	}
	return fn(ctx)
}

var _ ports.TxRunner = (*fakeRunner)(nil)

// =============================================================================
// fakeInstanceRepo -- instance.Repository
// =============================================================================

type fakeInstanceRepo struct {
	created          []*instance.Instance
	createErr        error
	findByCompanyOut *instance.Instance
	findByCompanyErr error
	findByIDOut      *instance.Instance
	findByIDErr      error
	listAllOut       []*instance.Instance
	listAllErr       error
	updateStatusErr  error
	updateJIDErr     error
	deleteErr        error
}

func (r *fakeInstanceRepo) Create(ctx context.Context, in *instance.Instance) error {
	if r.createErr != nil {
		return r.createErr
	}
	r.created = append(r.created, in)
	return nil
}

func (r *fakeInstanceRepo) FindByID(ctx context.Context, id id.ID) (*instance.Instance, error) {
	return r.findByIDOut, r.findByIDErr
}

func (r *fakeInstanceRepo) FindByCompany(ctx context.Context, companyID string) (*instance.Instance, error) {
	return r.findByCompanyOut, r.findByCompanyErr
}

func (r *fakeInstanceRepo) UpdateStatus(ctx context.Context, id id.ID, status instance.Status) error {
	return r.updateStatusErr
}

func (r *fakeInstanceRepo) UpdateWhatsmeowJID(ctx context.Context, id id.ID, jid string) error {
	return r.updateJIDErr
}

func (r *fakeInstanceRepo) ListAll(ctx context.Context) ([]*instance.Instance, error) {
	return r.listAllOut, r.listAllErr
}

func (r *fakeInstanceRepo) Delete(ctx context.Context, id id.ID) error {
	return r.deleteErr
}

var _ instance.Repository = (*fakeInstanceRepo)(nil)

// =============================================================================
// fakeDriver -- instance.Driver
// =============================================================================

type fakeDriver struct {
	connectCalls    int
	connectWith     *instance.Instance
	connectErr      error
	disconnectCalls int
	logoutCalls     int
	sendCalls       int
	sendArgs        struct{ instanceID, to, body string }
	sendOut         string
	sendErr         error
}

func (d *fakeDriver) Connect(ctx context.Context, in *instance.Instance) error {
	d.connectCalls++
	d.connectWith = in
	return d.connectErr
}
func (d *fakeDriver) Disconnect(ctx context.Context, _ id.ID) error { d.disconnectCalls++; return nil }
func (d *fakeDriver) Logout(ctx context.Context, _ id.ID) error     { d.logoutCalls++; return nil }
func (d *fakeDriver) SendText(ctx context.Context, instanceID id.ID, to, body string) (string, error) {
	d.sendCalls++
	d.sendArgs.instanceID = instanceID
	d.sendArgs.to = to
	d.sendArgs.body = body
	if d.sendErr != nil {
		return "", d.sendErr
	}
	return d.sendOut, nil
}

var _ instance.Driver = (*fakeDriver)(nil)

// =============================================================================
// fakePublisher -- ports.EventPublisher
// =============================================================================

type fakePublisher struct {
	instanceCreated   []events.InstanceCreatedEvent
	qrCodeUpdated     []events.QRCodeUpdatedEvent
	connectionUpdated []events.ConnectionUpdatedEvent
	messageReceived   []events.MessageReceivedEvent
	messageSent       []events.MessageSentEvent
	failOn            string // "instance.created" | "message.sent" | ...
	failWith          error
}

func (p *fakePublisher) PublishInstanceCreated(ctx context.Context, evt events.InstanceCreatedEvent) error {
	if p.failOn == "instance.created" {
		return p.failWith
	}
	p.instanceCreated = append(p.instanceCreated, evt)
	return nil
}

func (p *fakePublisher) PublishQRCodeUpdated(ctx context.Context, evt events.QRCodeUpdatedEvent) error {
	if p.failOn == "instance.qrcode.updated" {
		return p.failWith
	}
	p.qrCodeUpdated = append(p.qrCodeUpdated, evt)
	return nil
}

func (p *fakePublisher) PublishConnectionUpdated(ctx context.Context, evt events.ConnectionUpdatedEvent) error {
	if p.failOn == "instance.connection.updated" {
		return p.failWith
	}
	p.connectionUpdated = append(p.connectionUpdated, evt)
	return nil
}

func (p *fakePublisher) PublishMessageReceived(ctx context.Context, evt events.MessageReceivedEvent) error {
	if p.failOn == "message.received" {
		return p.failWith
	}
	p.messageReceived = append(p.messageReceived, evt)
	return nil
}

func (p *fakePublisher) PublishMessageSent(ctx context.Context, evt events.MessageSentEvent) error {
	if p.failOn == "message.sent" {
		return p.failWith
	}
	p.messageSent = append(p.messageSent, evt)
	return nil
}

var _ ports.EventPublisher = (*fakePublisher)(nil)

// errSentinel ajuda asserts errors.Is em varios testes.
var errSentinel = errors.New("falha sintetica")
