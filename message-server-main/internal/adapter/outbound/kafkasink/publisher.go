// Package kafkasink e o sink final que publica records em Kafka.
//
// Em G2 deixou de ser injetado como ports.EventPublisher (esse papel e
// agora do outbox.Publisher). Continua sendo usado pelo relay para
// drenar a tabela outbox e produzir os records de fato no broker.
package kafkasink

import (
	"context"

	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
)

// Sink expoe somente Produce. Mantemos a abstracao kafka.Producer para
// permitir mocks no relay sem importar o cliente concreto.
type Sink struct {
	producer kafka.Producer
}

// New constroi o sink.
func New(producer kafka.Producer) *Sink {
	return &Sink{producer: producer}
}

// Produce publica um record em Kafka.
func (s *Sink) Produce(ctx context.Context, r kafka.Record) error {
	return s.producer.Produce(ctx, r)
}
