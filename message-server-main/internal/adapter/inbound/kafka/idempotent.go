// idempotent.go: decorator que garante exactly-once logico no consumer.
//
// Em torno de cada handler Kafka registrado no router, embrulha:
//  1. extrai traceparent do header (W3C TraceContext) e cria span filho;
//  2. extrai event_id do header (ou do envelope, fallback);
//  3. abre tx via TxManager;
//  4. tenta inserir no inbox via Recorder.MarkProcessed;
//  5. se firstTime=false (duplicata), retorna nil (commit empty);
//  6. caso contrario, executa o handler interno DENTRO da mesma tx --
//     a entrada na inbox so e committada se o handler tambem suceder;
//  7. observa duracao em messageserver_kafka_handler_duration_seconds.
package inboundkafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/platform/metrics"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// inboxRecorder e a parte do *outbox.Recorder consumida pelo decorator.
// Declarado localmente para permitir mocks em testes unitarios sem
// importar o pacote concreto.
type inboxRecorder interface {
	MarkProcessed(ctx context.Context, eventID, topic string) (bool, error)
}

// txRunner espelha ports.TxRunner. Mantemos uma copia local para nao
// criar dependencia da camada inbound em application/ports.
type txRunner interface {
	Run(ctx context.Context, fn func(ctx context.Context) error) error
}

// IdempotentHandler decora inner garantindo idempotencia por event_id.
//
// metrics pode ser nil em testes unitarios -- nesse caso a observacao
// e suprimida para nao acoplar testes ao registro Prometheus.
func IdempotentHandler(
	recorder inboxRecorder,
	tm txRunner,
	log logger.Logger,
	m *metrics.Metrics,
	inner kafka.Handler,
) kafka.Handler {
	tracer := otel.Tracer("inbound.kafka")
	return func(ctx context.Context, rec kafka.Record) error {
		// 1. propagar trace_context vindo do producer.
		carrier := propagation.MapCarrier{}
		for k, v := range rec.Headers {
			carrier[k] = string(v)
		}
		ctx = otel.GetTextMapPropagator().Extract(ctx, carrier)

		ctx, span := tracer.Start(ctx, "kafka.consume "+rec.Topic,
			trace.WithSpanKind(trace.SpanKindConsumer),
		)
		defer span.End()

		started := time.Now()
		err := handleOnce(ctx, recorder, tm, log, rec, inner)
		observe(m, rec.Topic, err, time.Since(started))
		if err != nil {
			span.RecordError(err)
		}
		return err
	}
}

func handleOnce(
	ctx context.Context,
	recorder inboxRecorder,
	tm txRunner,
	log logger.Logger,
	rec kafka.Record,
	inner kafka.Handler,
) error {
	eventID, err := extractEventID(rec)
	if err != nil {
		log.Error(ctx, "kafka: dropping record without event_id",
			"topic", rec.Topic,
			"err", err.Error(),
		)
		return nil
	}
	return tm.Run(ctx, func(ctx context.Context) error {
		firstTime, err := recorder.MarkProcessed(ctx, eventID, rec.Topic)
		if err != nil {
			return fmt.Errorf("inboundkafka: inbox mark: %w", err)
		}
		if !firstTime {
			log.Info(ctx, "kafka: duplicate event ignored",
				"topic", rec.Topic,
				"event_id", eventID,
			)
			return nil
		}
		return inner(ctx, rec)
	})
}

func observe(m *metrics.Metrics, topic string, err error, dur time.Duration) {
	if m == nil {
		return
	}
	outcome := "success"
	if err != nil {
		outcome = "error"
	}
	m.KafkaHandlerDuration.WithLabelValues(topic, outcome).Observe(dur.Seconds())
}

// extractEventID le o header "event_id" e cai no envelope.event_id se
// o header estiver ausente. Retorna erro quando nenhum dos dois e
// utilizavel.
func extractEventID(rec kafka.Record) (string, error) {
	if v, ok := rec.Headers["event_id"]; ok && len(v) > 0 {
		return string(v), nil
	}
	var probe struct {
		EventID string `json:"event_id"`
	}
	if err := json.Unmarshal(rec.Value, &probe); err == nil && probe.EventID != "" {
		return probe.EventID, nil
	}
	return "", fmt.Errorf("missing event_id (header and envelope.event_id)")
}
