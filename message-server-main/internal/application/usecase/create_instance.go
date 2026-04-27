package usecase

import (
	"context"
	"errors"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/application/ports"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
)

// CreateInstanceCommand e a entrada do caso de uso.
type CreateInstanceCommand struct {
	CompanyID string
	Name      string
}

// CreateInstanceOutput e a saida (apenas o ID criado).
type CreateInstanceOutput struct {
	InstanceID string
}

// CreateInstance instancia uma nova sessao WhatsApp e dispara conexao.
//
// Em G2 o caso de uso passa a operar dentro de uma transacao Postgres
// gerenciada pelo TxRunner: persistencia + insercao no outbox sao
// atomicas. A chamada ao driver WhatsApp (efeito externo) acontece
// FORA da transacao -- senao seguraria a conexao do pool por todo o
// handshake da sessao e exigiria 2PC, que nao temos.
type CreateInstance struct {
	tx        ports.TxRunner
	repo      instance.Repository
	driver    instance.Driver
	publisher ports.EventPublisher
}

// NewCreateInstance constroi o caso de uso com suas dependencias.
func NewCreateInstance(
	txRunner ports.TxRunner,
	repo instance.Repository,
	driver instance.Driver,
	publisher ports.EventPublisher,
) *CreateInstance {
	return &CreateInstance{tx: txRunner, repo: repo, driver: driver, publisher: publisher}
}

// Execute aplica o caso de uso.
func (uc *CreateInstance) Execute(ctx context.Context, cmd CreateInstanceCommand) (CreateInstanceOutput, error) {
	inst, err := instance.New(cmd.CompanyID, cmd.Name)
	if err != nil {
		return CreateInstanceOutput{}, err
	}

	// Bloco transacional: valida unicidade, persiste e enfileira o
	// evento no outbox. Falha em qualquer ponto -> rollback completo.
	if err := uc.tx.Run(ctx, func(ctx context.Context) error {
		if existing, _ := uc.repo.FindByCompany(ctx, cmd.CompanyID); existing != nil {
			return errs.New(
				errs.KindConflict,
				"INSTANCE_ALREADY_EXISTS",
				"empresa ja possui instancia ativa",
			)
		}

		if err := uc.repo.Create(ctx, inst); err != nil {
			return errs.Wrap(errs.KindInternal, "INSTANCE_PERSIST_FAILED", "falha ao persistir instancia", err)
		}

		// Enriquece o ctx com tenant_id (== company_id) para o outbox.
		pctx := events.WithTenantID(ctx, inst.CompanyID())
		if err := uc.publisher.PublishInstanceCreated(pctx, events.InstanceCreatedEvent{
			InstanceID: inst.ID(),
			CompanyID:  inst.CompanyID(),
			Name:       inst.Name(),
			CreatedAt:  inst.CreatedAt(),
		}); err != nil {
			return errs.Wrap(errs.KindInternal, "EVENT_ENQUEUE_FAILED", "falha ao enfileirar evento de criacao", err)
		}
		return nil
	}); err != nil {
		var domainErr *errs.Error
		if errors.As(err, &domainErr) {
			return CreateInstanceOutput{}, domainErr
		}
		return CreateInstanceOutput{}, errs.Wrap(errs.KindInternal, "CREATE_INSTANCE_TX_FAILED", "transacao de criacao falhou", err)
	}

	if err := uc.driver.Connect(ctx, inst); err != nil {
		return CreateInstanceOutput{}, errs.Wrap(errs.KindUnavailable, "INSTANCE_CONNECT_FAILED", "falha ao iniciar sessao WhatsApp", err)
	}

	return CreateInstanceOutput{InstanceID: inst.ID()}, nil
}
