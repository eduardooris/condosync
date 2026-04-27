// Package inboundkafka traduz mensagens consumidas do Kafka em chamadas
// aos casos de uso. Este e o "controller" da nossa aplicacao para o
// transporte assincrono.
//
// Cada handler:
//   - faz unmarshal do envelope;
//   - valida campos minimos;
//   - delega ao caso de uso correspondente.
package inboundkafka

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/config"
	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/platform/metrics"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
)

// Router liga consumidor Kafka aos casos de uso.
type Router struct {
	logger          logger.Logger
	topics          config.KafkaTopics
	createInstance  *usecase.CreateInstance
	sendTextMessage *usecase.SendTextMessage
	metrics         *metrics.Metrics
}

// New constroi o router. metrics pode ser nil em testes.
func New(
	log logger.Logger,
	topics config.KafkaTopics,
	createInstance *usecase.CreateInstance,
	sendTextMessage *usecase.SendTextMessage,
	m *metrics.Metrics,
) *Router {
	return &Router{
		logger:          log,
		topics:          topics,
		createInstance:  createInstance,
		sendTextMessage: sendTextMessage,
		metrics:         m,
	}
}

// Register inscreve os handlers no consumer envolvendo cada um no
// IdempotentHandler. Toda mensagem inbound passa por:
//
//	tx { inbox.MarkProcessed -> inner handler }
//
// Reentregas com o mesmo event_id sao silenciosamente ignoradas.
//
// Recebe interfaces (e nao *outbox.Recorder / *tx.Manager) para manter
// o adapter testavel sem subir Postgres. metrics pode ser nil em testes.
func (r *Router) Register(c kafka.Consumer, recorder inboxRecorder, tm txRunner, m *metrics.Metrics) {
	c.Subscribe(r.topics.CmdInstanceCreate,
		IdempotentHandler(recorder, tm, r.logger, m, r.handleCreateInstance))
	c.Subscribe(r.topics.CmdMessageSendText,
		IdempotentHandler(recorder, tm, r.logger, m, r.handleSendTextMessage))
}

func (r *Router) instrumentOutgoing(instanceID, outcome string) {
	if r.metrics == nil {
		return
	}
	r.metrics.OutgoingMessagesTotal.WithLabelValues(instanceID, "TEXT", outcome).Inc()
}

func (r *Router) handleCreateInstance(ctx context.Context, rec kafka.Record) error {
	var env events.EventEnvelope[events.CreateInstanceCommand]
	if err := json.Unmarshal(rec.Value, &env); err != nil {
		return fmt.Errorf("inboundkafka: unmarshal create-instance: %w", err)
	}
	_, err := r.createInstance.Execute(ctx, usecase.CreateInstanceCommand{
		CompanyID: env.Payload.CompanyID,
		Name:      env.Payload.Name,
	})
	return r.classifyHandlerError(ctx, rec.Topic, "", err)
}

func (r *Router) handleSendTextMessage(ctx context.Context, rec kafka.Record) error {
	var env events.EventEnvelope[events.SendTextMessageCommand]
	if err := json.Unmarshal(rec.Value, &env); err != nil {
		return fmt.Errorf("inboundkafka: unmarshal send-text: %w", err)
	}
	_, err := r.sendTextMessage.Execute(ctx, usecase.SendTextMessageCommand{
		InstanceID: env.Payload.InstanceID,
		To:         env.Payload.To,
		Body:       env.Payload.Body,
	})
	outcome := "success"
	if err != nil {
		outcome = "error"
	}
	r.instrumentOutgoing(env.Payload.InstanceID, outcome)
	return r.classifyHandlerError(ctx, rec.Topic, env.Payload.InstanceID, err)
}

// classifyHandlerError decide se um erro de caso de uso deve provocar
// retry do consumer Kafka ou ser DROPADO (commit como sucesso).
//
// Erros transientes (KindInternal) sao propagados -- o consumer NAO
// commita o offset e o registro sera reentregue. Erros terminais de
// dominio (KindValidation, KindNotFound, KindConflict, KindForbidden,
// KindUnauthorized, KindUnavailable) sao DROPADOS:
//
//   - sao deterministicos: reentregar nao muda o resultado e prende o
//     consumer no mesmo offset (causa o "handler failed; will retry on
//     rebalance" em loop observado em prod);
//   - ja temos metrica `outgoing_messages_total{outcome="error"}`
//     contabilizando para alerta;
//   - quando ha DLQ configurada, eh nela que esses devem cair (TODO
//     futuro: enviar para wpp.dlq.* aqui).
//
// Caso especifico: "no LID found for ..." vem do whatsmeow embrulhado
// em KindUnavailable/MESSAGE_SEND_FAILED -- sao recipients invalidos
// (numero inexistente / mal formado) e nao melhoram com retry.
func (r *Router) classifyHandlerError(ctx context.Context, topic, instanceID string, err error) error {
	if err == nil {
		return nil
	}
	var de *errs.Error
	if errors.As(err, &de) {
		switch de.Kind {
		case errs.KindInternal:
			r.logger.Error(ctx, "handler erro interno (retry)",
				"topic", topic, "instance_id", instanceID,
				"code", de.Code, "err", err.Error())
			return err
		default:
			r.logger.Error(ctx, "handler erro de dominio (drop, sem retry)",
				"topic", topic, "instance_id", instanceID,
				"kind", string(de.Kind), "code", de.Code, "err", err.Error())
			return nil
		}
	}
	r.logger.Error(ctx, "handler erro nao classificado (retry)",
		"topic", topic, "instance_id", instanceID, "err", err.Error())
	return err
}
