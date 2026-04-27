// Package ports declara os ports de saida (output ports) necessarios
// pelos casos de uso. Os ports de dominio (Repository, Driver) vivem
// junto da entidade que os usa; este package concentra contratos
// transversais como publicacao de eventos.
package ports

import (
	"context"

	"github.com/IAtend-LOC/message-server/internal/application/events"
)

// EventPublisher abstrai o publicador de eventos de dominio.
//
// Em G2 a implementacao injetada e o outbox.Publisher: cada Publish*
// grava um registro na tabela message_server.outbox dentro da MESMA
// transacao da mutacao de estado, e o relay drena assincronamente para
// Kafka. Isto garante que evento e estado nunca divergem.
type EventPublisher interface {
	PublishInstanceCreated(ctx context.Context, evt events.InstanceCreatedEvent) error
	PublishQRCodeUpdated(ctx context.Context, evt events.QRCodeUpdatedEvent) error
	PublishConnectionUpdated(ctx context.Context, evt events.ConnectionUpdatedEvent) error
	PublishMessageReceived(ctx context.Context, evt events.MessageReceivedEvent) error
	PublishMessageSent(ctx context.Context, evt events.MessageSentEvent) error
}

// TxRunner abstrai o gerenciador de transacoes.
//
// O caso de uso depende deste port (e nao de *tx.Manager) para nao
// importar pgx/pgxpool e para permitir testes unitarios com fakes.
// A implementacao concreta vive em internal/platform/postgres/tx.
type TxRunner interface {
	// Run executa fn dentro de uma transacao Postgres. Se ja houver
	// uma tx no ctx (caso do IdempotentHandler envolvendo um UC que
	// tambem chama Run), a tx e reaproveitada sem aninhamento real.
	Run(ctx context.Context, fn func(ctx context.Context) error) error
}
