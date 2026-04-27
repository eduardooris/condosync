// Package events define os contratos publicos trafegados em Kafka entre
// o whatsapp-gateway e a message-server.
//
// Este pacote e a "ACL" (anti-corruption layer) entre dominios. Toda
// quebra de compatibilidade exige bump de versao no nome do topico
// (sufixo .v2) e periodo de coexistencia com a versao anterior.
package events

import (
	"context"
	"time"
)

// EventEnvelope e o envelope padrao de TODA mensagem trafegada em Kafka.
// Permite versionamento, correlacao e introspecao sem acoplar payloads.
//
// Contrato G2: EventID e obrigatorio (preenchido pelo publisher) e
// TraceParent e opcional (preenchido em G4 quando OTel for adicionado).
//
// TenantID e obrigatorio em todo evento publicado em Kafka -- o consumidor
// (whatsapp-gateway) valida e rejeita envelopes sem tenant_id.
type EventEnvelope[T any] struct {
	EventID       string    `json:"event_id"`                 // UUID unico, obrigatorio
	EventType     string    `json:"event_type"`               // ex.: "message.received"
	EventVersion  string    `json:"event_version"`            // ex.: "1.0"
	TenantID      string    `json:"tenant_id"`                // obrigatorio (== company_id da instance)
	OccurredAt    time.Time `json:"occurred_at"`              // UTC
	CorrelationID string    `json:"correlation_id,omitempty"` // tracing entre servicos
	Source        string    `json:"source"`                   // sempre "message-server" ou "wpp-gateway"
	TraceParent   string    `json:"trace_parent,omitempty"`   // W3C traceparent (G4)
	Payload       T         `json:"payload"`
}

// tenantCtxKey e a chave (privada) usada para carregar o tenant_id no
// context.Context entre as camadas. Evita que callers confundam com
// strings genericas.
type tenantCtxKey struct{}

// WithTenantID devolve um ctx que carrega o tenantID. Os callers (usecases
// e o dispatcher whatsmeow) chamam isto antes de invocar o EventPublisher
// para que o outbox.Publisher consiga preencher o envelope sem precisar
// receber o tenantID em cada metodo da interface.
func WithTenantID(ctx context.Context, tenantID string) context.Context {
	if tenantID == "" {
		return ctx
	}
	return context.WithValue(ctx, tenantCtxKey{}, tenantID)
}

// TenantIDFrom extrai o tenantID do ctx; "" quando ausente.
func TenantIDFrom(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	v, _ := ctx.Value(tenantCtxKey{}).(string)
	return v
}

// ============================================================================
// COMMANDS (consumidos pela message-server)
// ============================================================================

// CreateInstanceCommand pede a criacao de uma sessao WhatsApp.
type CreateInstanceCommand struct {
	CompanyID string `json:"company_id"`
	Name      string `json:"name"`
}

// DeleteInstanceCommand encerra e remove uma sessao WhatsApp.
type DeleteInstanceCommand struct {
	InstanceID string `json:"instance_id"`
}

// SendTextMessageCommand envia uma mensagem de texto.
type SendTextMessageCommand struct {
	InstanceID string `json:"instance_id"`
	To         string `json:"to"` // E.164 sem '+', ex.: "5511999999999"
	Body       string `json:"body"`
}

// ============================================================================
// EVENTS (publicados pela message-server)
// ============================================================================

// QRCodeUpdatedEvent e emitido sempre que o whatsmeow renova o QR code.
type QRCodeUpdatedEvent struct {
	InstanceID string    `json:"instance_id"`
	Code       string    `json:"code"`
	ExpiresAt  time.Time `json:"expires_at"`
}

// ConnectionUpdatedEvent reflete a transicao de status da sessao.
type ConnectionUpdatedEvent struct {
	InstanceID string `json:"instance_id"`
	Status     string `json:"status"` // ver instance.Status
	Reason     string `json:"reason,omitempty"`
}

// MessageReceivedEvent e emitido para cada mensagem entrante observada.
type MessageReceivedEvent struct {
	InstanceID string    `json:"instance_id"`
	WppID      string    `json:"wpp_id"`
	From       string    `json:"from"`
	To         string    `json:"to"`
	Body       string    `json:"body"`
	Timestamp  time.Time `json:"timestamp"`
}

// MessageSentEvent confirma que a message-server entregou uma mensagem
// ao WhatsApp em resposta a um SendTextMessageCommand.
type MessageSentEvent struct {
	InstanceID string    `json:"instance_id"`
	WppID      string    `json:"wpp_id"`
	To         string    `json:"to"`
	Body       string    `json:"body"`
	Timestamp  time.Time `json:"timestamp"`
}

// InstanceCreatedEvent e emitido quando uma nova instancia e persistida.
// Introduzido em G2 (antes do escopo nominal de G3) para que o cenario 1
// de G4.2 ja tenha um evento observavel ponta-a-ponta.
type InstanceCreatedEvent struct {
	InstanceID string    `json:"instance_id"`
	CompanyID  string    `json:"company_id"`
	Name       string    `json:"name"`
	CreatedAt  time.Time `json:"created_at"`
}
