package usecase

import (
	"context"

	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
)

// ReconnectInstanceCommand identifica a instancia a reconectar.
//
// Pelo menos um dos campos deve estar preenchido. InstanceID tem
// prioridade quando ambos forem informados.
type ReconnectInstanceCommand struct {
	InstanceID string
	CompanyID  string
}

// ReconnectInstanceOutput devolve o id da instancia reconectada para
// que o chamador possa associar/cachear corretamente.
type ReconnectInstanceOutput struct {
	InstanceID string
}

// ReconnectInstance recupera uma sessao whatsmeow ja existente.
//
// E util quando o message-server reinicia ou perde a sessao em memoria
// e a instancia ainda nao foi pareada (status PENDING). Nesse cenario
// o RecoverSessions ignora a instancia (sem JID), e o caso de uso
// CreateInstance falha por unicidade.
type ReconnectInstance struct {
	repo   instance.Repository
	driver instance.Driver
}

func NewReconnectInstance(
	repo instance.Repository,
	driver instance.Driver,
) *ReconnectInstance {
	return &ReconnectInstance{repo: repo, driver: driver}
}

func (uc *ReconnectInstance) Execute(ctx context.Context, cmd ReconnectInstanceCommand) (ReconnectInstanceOutput, error) {
	if cmd.InstanceID == "" && cmd.CompanyID == "" {
		return ReconnectInstanceOutput{}, errs.New(
			errs.KindValidation,
			"INSTANCE_LOOKUP_REQUIRED",
			"informe instance_id ou company_id",
		)
	}

	var (
		inst *instance.Instance
		err  error
	)
	if cmd.InstanceID != "" {
		inst, err = uc.repo.FindByID(ctx, cmd.InstanceID)
	} else {
		inst, err = uc.repo.FindByCompany(ctx, cmd.CompanyID)
	}
	if err != nil {
		return ReconnectInstanceOutput{}, err
	}
	if inst == nil {
		return ReconnectInstanceOutput{}, errs.New(
			errs.KindNotFound,
			"INSTANCE_NOT_FOUND",
			"instancia nao encontrada",
		)
	}

	// Best effort: encerra sessao em memoria caso ainda exista. Isso
	// garante que o Connect abaixo recriara o cliente whatsmeow do
	// zero e abrira um novo canal de QR.
	_ = uc.driver.Disconnect(ctx, inst.ID())

	if err := uc.driver.Connect(ctx, inst); err != nil {
		return ReconnectInstanceOutput{}, errs.Wrap(
			errs.KindUnavailable,
			"INSTANCE_CONNECT_FAILED",
			"falha ao reiniciar sessao WhatsApp",
			err,
		)
	}
	return ReconnectInstanceOutput{InstanceID: inst.ID()}, nil
}
