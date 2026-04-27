// Package message modela uma mensagem WhatsApp (entrante ou sainte)
// observada pela message-server. Persistencia local serve apenas para
// auditoria + idempotencia; a fonte de verdade do consumidor e o evento
// publicado em Kafka.
package message

import (
	"context"
	"strings"
	"time"

	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// Direction indica se a mensagem foi recebida ou enviada pela instancia.
type Direction string

const (
	DirectionInbound  Direction = "INBOUND"
	DirectionOutbound Direction = "OUTBOUND"
)

// Kind classifica o tipo de conteudo. Por enquanto so temos texto;
// novos tipos (audio, image, document) entram aqui sem quebrar o port.
type Kind string

const (
	KindText Kind = "TEXT"
)

// Message e a entidade-raiz deste agregado.
type Message struct {
	id         id.ID
	instanceID id.ID
	wppID      string // ID atribuido pelo WhatsApp (server-assigned)
	direction  Direction
	kind       Kind
	from       string
	to         string
	body       string
	timestamp  time.Time
}

// NewInbound cria uma mensagem recebida.
func NewInbound(instanceID id.ID, wppID, from, to, body string, ts time.Time) (*Message, error) {
	return newMessage(instanceID, wppID, DirectionInbound, from, to, body, ts)
}

// NewOutbound cria uma mensagem enviada pela instancia.
func NewOutbound(instanceID id.ID, wppID, from, to, body string, ts time.Time) (*Message, error) {
	return newMessage(instanceID, wppID, DirectionOutbound, from, to, body, ts)
}

func newMessage(instanceID id.ID, wppID string, dir Direction, from, to, body string, ts time.Time) (*Message, error) {
	if strings.TrimSpace(instanceID) == "" {
		return nil, errs.New(errs.KindValidation, "MESSAGE_INSTANCE_REQUIRED", "instanceID e obrigatorio")
	}
	if strings.TrimSpace(body) == "" {
		return nil, errs.New(errs.KindValidation, "MESSAGE_BODY_REQUIRED", "body e obrigatorio")
	}
	if strings.TrimSpace(from) == "" || strings.TrimSpace(to) == "" {
		return nil, errs.New(errs.KindValidation, "MESSAGE_PEERS_REQUIRED", "from/to obrigatorios")
	}
	if ts.IsZero() {
		ts = time.Now().UTC()
	}
	return &Message{
		id:         id.New(),
		instanceID: instanceID,
		wppID:      wppID,
		direction:  dir,
		kind:       KindText,
		from:       from,
		to:         to,
		body:       body,
		timestamp:  ts.UTC(),
	}, nil
}

func (m *Message) ID() id.ID            { return m.id }
func (m *Message) InstanceID() id.ID    { return m.instanceID }
func (m *Message) WppID() string        { return m.wppID }
func (m *Message) Direction() Direction { return m.direction }
func (m *Message) Kind() Kind           { return m.kind }
func (m *Message) From() string         { return m.from }
func (m *Message) To() string           { return m.to }
func (m *Message) Body() string         { return m.body }
func (m *Message) Timestamp() time.Time { return m.timestamp }

// Hydrate reconstroi uma Message a partir do storage. NAO aplica
// invariantes de criacao - destinado exclusivamente a repositorios.
func Hydrate(
	mid id.ID,
	instanceID id.ID,
	wppID string,
	dir Direction,
	kind Kind,
	from, to, body string,
	ts time.Time,
) *Message {
	return &Message{
		id:         mid,
		instanceID: instanceID,
		wppID:      wppID,
		direction:  dir,
		kind:       kind,
		from:       from,
		to:         to,
		body:       body,
		timestamp:  ts.UTC(),
	}
}

// Repository e o port de persistencia para mensagens.
//
// Save e idempotente: chamadas com o mesmo (instance_id, wpp_id, direction)
// inserem apenas a primeira; chamadas subsequentes retornam (false, nil).
// Isto sustenta a garantia de exactly-once logico nos pipelines inbound
// e outbound (G3, G5).
type Repository interface {
	Save(ctx context.Context, msg *Message) (inserted bool, err error)
	ExistsByWppID(ctx context.Context, instanceID id.ID, wppID string, dir Direction) (bool, error)
}
