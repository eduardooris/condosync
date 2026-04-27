package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/application/ports"
	"github.com/IAtend-LOC/message-server/internal/domain/message"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// IngestIncomingMessageCommand carrega os campos extraidos do
// *events.Message do whatsmeow. O dispatcher do driver e quem traduz
// o evento bruto da lib para este comando, mantendo a regra de negocio
// (idempotencia + decisao de publicar) na camada application.
type IngestIncomingMessageCommand struct {
	InstanceID id.ID
	WppID      string
	From       string
	To         string
	Body       string
	Timestamp  time.Time
	FromMe     bool
}

// IngestIncomingMessage e o caso de uso disparado para cada mensagem
// observada pelo driver whatsmeow. Garante que:
//
//  1. a mensagem e persistida exatamente uma vez (idempotencia local
//     via UNIQUE (instance_id, wpp_id, direction));
//  2. o evento de saida so e publicado quando a mensagem foi
//     efetivamente inserida (Save retorna inserted=true);
//  3. mensagens fromMe (echo do que enviamos) sao persistidas para
//     auditoria mas NAO publicadas -- o gateway ja recebeu o
//     MessageSentEvent na hora do envio.
type IngestIncomingMessage struct {
	tx        ports.TxRunner
	repo      message.Repository
	publisher ports.EventPublisher
}

func NewIngestIncomingMessage(
	txRunner ports.TxRunner,
	repo message.Repository,
	publisher ports.EventPublisher,
) *IngestIncomingMessage {
	return &IngestIncomingMessage{tx: txRunner, repo: repo, publisher: publisher}
}

func (uc *IngestIncomingMessage) Execute(ctx context.Context, cmd IngestIncomingMessageCommand) error {
	dir := message.DirectionInbound
	if cmd.FromMe {
		dir = message.DirectionOutbound
	}

	var msg *message.Message
	var err error
	if cmd.FromMe {
		msg, err = message.NewOutbound(cmd.InstanceID, cmd.WppID, cmd.From, cmd.To, cmd.Body, cmd.Timestamp)
	} else {
		msg, err = message.NewInbound(cmd.InstanceID, cmd.WppID, cmd.From, cmd.To, cmd.Body, cmd.Timestamp)
	}
	if err != nil {
		return err
	}

	return uc.tx.Run(ctx, func(ctx context.Context) error {
		inserted, err := uc.repo.Save(ctx, msg)
		if err != nil {
			return errs.Wrap(errs.KindInternal, "MESSAGE_PERSIST_FAILED", "falha ao persistir mensagem", err)
		}
		// Idempotencia local: ja vimos esta mensagem antes.
		if !inserted {
			return nil
		}
		// Mensagem outbound (echo) ja teve evento publicado no envio.
		if dir == message.DirectionOutbound {
			return nil
		}
		if err := uc.publisher.PublishMessageReceived(ctx, events.MessageReceivedEvent{
			InstanceID: cmd.InstanceID,
			WppID:      cmd.WppID,
			From:       cmd.From,
			To:         cmd.To,
			Body:       cmd.Body,
			Timestamp:  cmd.Timestamp,
		}); err != nil {
			var domainErr *errs.Error
			if errors.As(err, &domainErr) {
				return domainErr
			}
			return errs.Wrap(errs.KindInternal, "EVENT_ENQUEUE_FAILED", "mensagem persistida mas evento nao enfileirado", err)
		}
		return nil
	})
}
