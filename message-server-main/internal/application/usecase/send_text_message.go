package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/application/ports"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
)

type SendTextMessageCommand struct {
	InstanceID string
	To         string
	Body       string
}

type SendTextMessageOutput struct {
	WppMessageID string
}

// SendTextMessage envia uma mensagem de texto e publica o evento de
// confirmacao via outbox.
//
// Ordem das operacoes:
//  1. carrega a instancia e valida estado (sem tx);
//  2. chama o driver WhatsApp (efeito externo, fora da tx para nao
//     reter conexao do pool durante o RTT do servidor WhatsApp);
//  3. abre transacao e enfileira o MessageSentEvent no outbox.
//
// Se a etapa (3) falhar, retornamos KindInternal mas o WppMessageID
// e propagado ao chamador -- a mensagem ja foi entregue ao WhatsApp e
// o consumidor (gateway) sera idempotente quando o evento finalmente
// for publicado em uma reentrega futura.
type SendTextMessage struct {
	tx        ports.TxRunner
	repo      instance.Repository
	driver    instance.Driver
	publisher ports.EventPublisher
}

func NewSendTextMessage(
	txRunner ports.TxRunner,
	repo instance.Repository,
	driver instance.Driver,
	publisher ports.EventPublisher,
) *SendTextMessage {
	return &SendTextMessage{tx: txRunner, repo: repo, driver: driver, publisher: publisher}
}

func (uc *SendTextMessage) Execute(ctx context.Context, cmd SendTextMessageCommand) (SendTextMessageOutput, error) {
	inst, err := uc.repo.FindByID(ctx, cmd.InstanceID)
	if err != nil {
		return SendTextMessageOutput{}, err
	}
	if inst == nil {
		return SendTextMessageOutput{}, errs.New(errs.KindNotFound, "INSTANCE_NOT_FOUND", "instancia nao encontrada")
	}
	if inst.Status() != instance.StatusConnected {
		return SendTextMessageOutput{}, errs.New(errs.KindUnavailable, "INSTANCE_NOT_CONNECTED", "instancia nao conectada")
	}

	wppID, err := uc.driver.SendText(ctx, inst.ID(), cmd.To, cmd.Body)
	if err != nil {
		return SendTextMessageOutput{}, errs.Wrap(errs.KindUnavailable, "MESSAGE_SEND_FAILED", "falha ao enviar mensagem", err)
	}

	if err := uc.tx.Run(ctx, func(ctx context.Context) error {
		// Enriquece o ctx com tenant_id (== company_id) para que o
		// outbox.Publisher consiga preencher o envelope.
		ctx = events.WithTenantID(ctx, inst.CompanyID())
		return uc.publisher.PublishMessageSent(ctx, events.MessageSentEvent{
			InstanceID: inst.ID(),
			WppID:      wppID,
			To:         cmd.To,
			Body:       cmd.Body,
			Timestamp:  time.Now().UTC(),
		})
	}); err != nil {
		var domainErr *errs.Error
		if errors.As(err, &domainErr) {
			return SendTextMessageOutput{WppMessageID: wppID}, domainErr
		}
		return SendTextMessageOutput{WppMessageID: wppID}, errs.Wrap(errs.KindInternal, "EVENT_ENQUEUE_FAILED", "mensagem entregue mas evento nao enfileirado", err)
	}

	return SendTextMessageOutput{WppMessageID: wppID}, nil
}
