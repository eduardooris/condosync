package usecase

import (
	"context"
	"errors"

	"github.com/IAtend-LOC/message-server/internal/application/ports"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
)

type DeleteInstanceCommand struct {
	InstanceID string
}

type DeleteInstance struct {
	tx     ports.TxRunner
	repo   instance.Repository
	driver instance.Driver
}

func NewDeleteInstance(
	txRunner ports.TxRunner,
	repo instance.Repository,
	driver instance.Driver,
) *DeleteInstance {
	return &DeleteInstance{tx: txRunner, repo: repo, driver: driver}
}

func (uc *DeleteInstance) Execute(ctx context.Context, cmd DeleteInstanceCommand) error {
	inst, err := uc.repo.FindByID(ctx, cmd.InstanceID)
	if err != nil {
		return err
	}
	if inst == nil {
		return errs.New(errs.KindNotFound, "INSTANCE_NOT_FOUND", "instancia nao encontrada")
	}

	// Best effort: se o device ainda existir, encerra sessao remota antes
	// de remover o vinculo local.
	if err := uc.driver.Logout(ctx, inst.ID()); err != nil {
		return errs.Wrap(errs.KindUnavailable, "INSTANCE_LOGOUT_FAILED", "falha ao encerrar sessao", err)
	}

	if err := uc.tx.Run(ctx, func(ctx context.Context) error {
		if err := uc.repo.Delete(ctx, inst.ID()); err != nil {
			return err
		}
		return nil
	}); err != nil {
		var domainErr *errs.Error
		if errors.As(err, &domainErr) {
			return domainErr
		}
		return errs.Wrap(errs.KindInternal, "DELETE_INSTANCE_TX_FAILED", "transacao de exclusao falhou", err)
	}
	return nil
}
