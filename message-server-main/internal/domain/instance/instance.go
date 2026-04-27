// Package instance modela a sessao WhatsApp de uma empresa (instance).
//
// O dominio NAO conhece whatsmeow, Kafka, Postgres ou qualquer infra.
// Ele expoe apenas:
//   - a entidade Instance (estado + invariantes);
//   - o port Repository (persistencia);
//   - o port Driver (operacoes na rede WhatsApp).
//
// Os adapters concretos vivem em internal/adapter/*.
package instance

import (
	"context"
	"strings"
	"time"

	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// Status descreve o ciclo de vida de uma instancia WhatsApp.
type Status string

const (
	StatusPending      Status = "PENDING"      // criada, aguardando QR/pair
	StatusConnecting   Status = "CONNECTING"   // QR gerado, aguardando scan
	StatusConnected    Status = "CONNECTED"    // sessao ativa
	StatusDisconnected Status = "DISCONNECTED" // perdeu conexao
	StatusLoggedOut    Status = "LOGGED_OUT"   // sessao revogada pelo usuario
)

// Instance e a entidade-raiz de agregacao deste dominio.
type Instance struct {
	id           id.ID
	companyID    string
	name         string
	status       Status
	whatsmeowJID string
	createdAt    time.Time
	updatedAt    time.Time
}

// New cria uma instancia em estado PENDING aplicando as invariantes.
func New(companyID, name string) (*Instance, error) {
	companyID = strings.TrimSpace(companyID)
	name = strings.TrimSpace(name)
	if companyID == "" {
		return nil, errs.New(errs.KindValidation, "INSTANCE_COMPANY_REQUIRED", "companyID e obrigatorio")
	}
	if name == "" {
		return nil, errs.New(errs.KindValidation, "INSTANCE_NAME_REQUIRED", "name e obrigatorio")
	}
	now := time.Now().UTC()
	return &Instance{
		id:        id.New(),
		companyID: companyID,
		name:      name,
		status:    StatusPending,
		createdAt: now,
		updatedAt: now,
	}, nil
}

// Hydrate reconstroi uma Instance a partir do storage. NAO aplica
// invariantes de criacao - destinado exclusivamente a repositorios.
func Hydrate(
	id id.ID,
	companyID, name string,
	status Status,
	whatsmeowJID string,
	createdAt, updatedAt time.Time,
) *Instance {
	return &Instance{
		id:           id,
		companyID:    companyID,
		name:         name,
		status:       status,
		whatsmeowJID: whatsmeowJID,
		createdAt:    createdAt,
		updatedAt:    updatedAt,
	}
}

func (i *Instance) ID() id.ID            { return i.id }
func (i *Instance) CompanyID() string    { return i.companyID }
func (i *Instance) Name() string         { return i.name }
func (i *Instance) Status() Status       { return i.status }
func (i *Instance) WhatsmeowJID() string { return i.whatsmeowJID }
func (i *Instance) CreatedAt() time.Time { return i.createdAt }
func (i *Instance) UpdatedAt() time.Time { return i.updatedAt }

// TransitionTo aplica uma transicao de status (idempotente).
func (i *Instance) TransitionTo(next Status) {
	if i.status == next {
		return
	}
	i.status = next
	i.updatedAt = time.Now().UTC()
}

// Repository e o port de persistencia.
type Repository interface {
	Create(ctx context.Context, instance *Instance) error
	FindByID(ctx context.Context, id id.ID) (*Instance, error)
	FindByCompany(ctx context.Context, companyID string) (*Instance, error)
	ListAll(ctx context.Context) ([]*Instance, error)
	UpdateStatus(ctx context.Context, id id.ID, status Status) error
	UpdateWhatsmeowJID(ctx context.Context, id id.ID, jid string) error
	Delete(ctx context.Context, id id.ID) error
}

// QRCode representa o pareamento pendente para uma instancia.
type QRCode struct {
	InstanceID id.ID
	Code       string
	ExpiresAt  time.Time
}

// Driver e o port que abstrai o cliente WhatsApp (whatsmeow).
// Eventos assincronos (qrcode, connection, mensagens recebidas) sao
// emitidos pelo driver via canais dedicados (ver application layer).
type Driver interface {
	// Connect inicia a sessao. Para instancias ainda nao pareadas o
	// driver devera emitir QRCode events ate que o pareamento ocorra.
	Connect(ctx context.Context, instance *Instance) error

	// Disconnect encerra a sessao mantendo a credencial.
	Disconnect(ctx context.Context, instanceID id.ID) error

	// Logout encerra a sessao e revoga a credencial no servidor WhatsApp.
	Logout(ctx context.Context, instanceID id.ID) error

	// SendText envia uma mensagem de texto. Retorna o ID da mensagem
	// confirmado pelo WhatsApp (server-assigned).
	SendText(ctx context.Context, instanceID id.ID, to, body string) (string, error)
}
