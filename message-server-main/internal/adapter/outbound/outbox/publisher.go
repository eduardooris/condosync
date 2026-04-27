// Package outbox implementa o pattern Transactional Outbox.
//
// Publisher implementa ports.EventPublisher gravando cada evento na
// tabela message_server.outbox dentro da transacao corrente (recuperada
// via txctx). O Relay (em relay.go) drena assincronamente para Kafka.
//
// Garantia: o evento e persistido na MESMA transacao que muta o estado
// do agregado, portanto eles nunca divergem mesmo em caso de crash do
// processo entre commit do DB e produce do Kafka.
package outbox

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/config"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/txctx"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
	"github.com/jackc/pgx/v5/pgxpool"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

const (
	source       = "message-server"
	eventVersion = "1.0"
)

// Publisher implementa ports.EventPublisher gravando na tabela outbox.
type Publisher struct {
	pool   *pgxpool.Pool
	topics config.KafkaTopics
}

// NewPublisher constroi o publisher.
func NewPublisher(pool *pgxpool.Pool, topics config.KafkaTopics) *Publisher {
	return &Publisher{pool: pool, topics: topics}
}

func (p *Publisher) PublishInstanceCreated(ctx context.Context, evt events.InstanceCreatedEvent) error {
	return p.enqueue(ctx, p.topics.EvtInstanceCreated, "instance.created", evt.InstanceID, evt)
}

func (p *Publisher) PublishQRCodeUpdated(ctx context.Context, evt events.QRCodeUpdatedEvent) error {
	return p.enqueue(ctx, p.topics.EvtInstanceQRCode, "instance.qrcode.updated", evt.InstanceID, evt)
}

func (p *Publisher) PublishConnectionUpdated(ctx context.Context, evt events.ConnectionUpdatedEvent) error {
	return p.enqueue(ctx, p.topics.EvtInstanceConnection, "instance.connection.updated", evt.InstanceID, evt)
}

func (p *Publisher) PublishMessageReceived(ctx context.Context, evt events.MessageReceivedEvent) error {
	return p.enqueue(ctx, p.topics.EvtMessageReceived, "message.received", evt.InstanceID, evt)
}

func (p *Publisher) PublishMessageSent(ctx context.Context, evt events.MessageSentEvent) error {
	return p.enqueue(ctx, p.topics.EvtMessageSent, "message.sent", evt.InstanceID, evt)
}

// enqueue serializa o envelope e insere o registro na tabela outbox.
//
// aggregateID = chave de particionamento Kafka (preserva ordem por
// instancia). headers e um map JSON com os mesmos campos que serao
// copiados para os headers Kafka pelo relay.
//
// tenant_id: lido do ctx (events.WithTenantID). E OBRIGATORIO -- o
// consumidor (whatsapp-gateway) rejeita envelopes sem tenant_id, e nao
// faz sentido publicar um evento sem dono. Quando ausente, retornamos
// erro para que a tx que originou a publicacao seja revertida -- evita
// "vazar" eventos orfaos no outbox que ficariam falhando no relay.
func (p *Publisher) enqueue(ctx context.Context, topic, eventType, aggregateID string, payload any) error {
	tenantID := events.TenantIDFrom(ctx)
	if tenantID == "" {
		return fmt.Errorf("outbox: events: missing tenant_id (topic=%s)", topic)
	}

	eventID := id.New()

	// W3C TraceContext: serializa o span ativo (se houver) no envelope
	// e nos headers do record. Se nao houver tracer ativo o carrier sai
	// vazio e o relay grava strings vazias -- consumer cuida disso.
	carrier := propagation.MapCarrier{}
	otel.GetTextMapPropagator().Inject(ctx, carrier)
	traceparent := carrier["traceparent"]

	envelope := events.EventEnvelope[any]{
		EventID:      eventID,
		EventType:    eventType,
		EventVersion: eventVersion,
		TenantID:     tenantID,
		OccurredAt:   time.Now().UTC(),
		Source:       source,
		TraceParent:  traceparent,
		Payload:      payload,
	}
	body, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("outbox: marshal envelope: %w", err)
	}
	headersMap := map[string]string{
		"event_id":      eventID,
		"event_type":    eventType,
		"event_version": eventVersion,
		"tenant_id":     tenantID,
	}
	if traceparent != "" {
		headersMap["traceparent"] = traceparent
		if ts := carrier["tracestate"]; ts != "" {
			headersMap["tracestate"] = ts
		}
	}
	headers, err := json.Marshal(headersMap)
	if err != nil {
		return fmt.Errorf("outbox: marshal headers: %w", err)
	}

	const q = `
		INSERT INTO message_server.outbox
			(id, aggregate_id, topic, key, payload, headers)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err = txctx.From(ctx, p.pool).Exec(ctx, q,
		eventID,
		aggregateID,
		topic,
		[]byte(aggregateID),
		body,
		headers,
	)
	if err != nil {
		return fmt.Errorf("outbox: insert topic=%s: %w", topic, err)
	}
	return nil
}
