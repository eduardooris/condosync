package usecase_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
)

func newCreateInstanceUC(
	runner *fakeRunner,
	repo *fakeInstanceRepo,
	driver *fakeDriver,
	pub *fakePublisher,
) *usecase.CreateInstance {
	return usecase.NewCreateInstance(runner, repo, driver, pub)
}

func TestCreateInstance_HappyPath(t *testing.T) {
	t.Parallel()
	runner := &fakeRunner{}
	repo := &fakeInstanceRepo{}
	driver := &fakeDriver{}
	pub := &fakePublisher{}

	out, err := newCreateInstanceUC(runner, repo, driver, pub).Execute(
		context.Background(),
		usecase.CreateInstanceCommand{CompanyID: "comp-1", Name: "default"},
	)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if out.InstanceID == "" {
		t.Fatal("InstanceID nao deveria ser vazio")
	}
	// Bloco transacional: 1 invocacao do runner.
	if runner.calls != 1 {
		t.Fatalf("runner deveria ser chamado 1x, foi %d", runner.calls)
	}
	if len(repo.created) != 1 {
		t.Fatalf("repo.Create deveria ser chamado 1x, foi %d", len(repo.created))
	}
	if len(pub.instanceCreated) != 1 {
		t.Fatalf("publisher deveria publicar 1 InstanceCreated, foi %d", len(pub.instanceCreated))
	}
	if pub.instanceCreated[0].CompanyID != "comp-1" || pub.instanceCreated[0].Name != "default" {
		t.Fatalf("payload do evento incorreto: %+v", pub.instanceCreated[0])
	}
	if driver.connectCalls != 1 {
		t.Fatalf("Connect deveria ser chamado 1x (FORA da tx), foi %d", driver.connectCalls)
	}
	// Pos-condicao: o evento referencia a mesma instancia persistida.
	if pub.instanceCreated[0].InstanceID != repo.created[0].ID() {
		t.Fatal("evento deve referenciar a mesma Instance persistida")
	}
}

func TestCreateInstance_ValidacaoFalhaAntesDaTx(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		cmd  usecase.CreateInstanceCommand
		code string
	}{
		{"company vazio", usecase.CreateInstanceCommand{CompanyID: "", Name: "x"}, "INSTANCE_COMPANY_REQUIRED"},
		{"name vazio", usecase.CreateInstanceCommand{CompanyID: "c", Name: ""}, "INSTANCE_NAME_REQUIRED"},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			runner := &fakeRunner{}
			driver := &fakeDriver{}
			_, err := newCreateInstanceUC(runner, &fakeInstanceRepo{}, driver, &fakePublisher{}).
				Execute(context.Background(), tc.cmd)
			if err == nil {
				t.Fatal("esperava erro de validacao")
			}
			var de *errs.Error
			if !errors.As(err, &de) || de.Code != tc.code {
				t.Fatalf("esperava code=%s, recebi %v", tc.code, err)
			}
			if runner.calls != 0 {
				t.Fatal("nao deveria abrir tx em validacao")
			}
			if driver.connectCalls != 0 {
				t.Fatal("nao deveria conectar em validacao")
			}
		})
	}
}

func TestCreateInstance_ConflitoEmpresaJaPossuiInstancia(t *testing.T) {
	t.Parallel()
	existing, _ := instance.New("comp-1", "outra")
	runner := &fakeRunner{}
	repo := &fakeInstanceRepo{findByCompanyOut: existing}
	driver := &fakeDriver{}
	pub := &fakePublisher{}

	_, err := newCreateInstanceUC(runner, repo, driver, pub).Execute(
		context.Background(),
		usecase.CreateInstanceCommand{CompanyID: "comp-1", Name: "x"},
	)
	if err == nil {
		t.Fatal("esperava erro de conflito")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Kind != errs.KindConflict || de.Code != "INSTANCE_ALREADY_EXISTS" {
		t.Fatalf("erro inesperado: %v", err)
	}
	// Tx aberta para validar unicidade, mas nada persistido nem publicado.
	if runner.calls != 1 {
		t.Fatalf("runner.calls=%d (esperado 1)", runner.calls)
	}
	if len(repo.created) != 0 || len(pub.instanceCreated) != 0 {
		t.Fatal("nada pode ser persistido ou publicado em conflito")
	}
	if driver.connectCalls != 0 {
		t.Fatal("driver nao pode ser chamado quando a tx falha")
	}
}

func TestCreateInstance_FalhaPersistirEnvolveErroOriginal(t *testing.T) {
	t.Parallel()
	runner := &fakeRunner{}
	repo := &fakeInstanceRepo{createErr: errSentinel}
	driver := &fakeDriver{}
	pub := &fakePublisher{}

	_, err := newCreateInstanceUC(runner, repo, driver, pub).Execute(
		context.Background(),
		usecase.CreateInstanceCommand{CompanyID: "c", Name: "x"},
	)
	if err == nil {
		t.Fatal("esperava erro")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Code != "INSTANCE_PERSIST_FAILED" {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !errors.Is(err, errSentinel) {
		t.Fatal("erro original deveria estar disponivel via errors.Is")
	}
	if len(pub.instanceCreated) != 0 || driver.connectCalls != 0 {
		t.Fatal("falha de persistir nao pode publicar nem conectar")
	}
}

func TestCreateInstance_FalhaPublisherNaoConecta(t *testing.T) {
	t.Parallel()
	runner := &fakeRunner{}
	repo := &fakeInstanceRepo{}
	driver := &fakeDriver{}
	pub := &fakePublisher{failOn: "instance.created", failWith: errSentinel}

	_, err := newCreateInstanceUC(runner, repo, driver, pub).Execute(
		context.Background(),
		usecase.CreateInstanceCommand{CompanyID: "c", Name: "x"},
	)
	if err == nil {
		t.Fatal("esperava erro")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Code != "EVENT_ENQUEUE_FAILED" {
		t.Fatalf("erro inesperado: %v", err)
	}
	if driver.connectCalls != 0 {
		t.Fatal("falha do publisher (rollback) nao pode disparar Connect")
	}
}

func TestCreateInstance_ErroInfraDoRunnerEhEmbruhado(t *testing.T) {
	t.Parallel()
	// Erro NAO-dominio do runner (ex.: BeginTx falhou) -> CREATE_INSTANCE_TX_FAILED.
	runner := &fakeRunner{failWith: errSentinel}
	_, err := newCreateInstanceUC(runner, &fakeInstanceRepo{}, &fakeDriver{}, &fakePublisher{}).
		Execute(context.Background(), usecase.CreateInstanceCommand{CompanyID: "c", Name: "x"})
	if err == nil {
		t.Fatal("esperava erro")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Code != "CREATE_INSTANCE_TX_FAILED" {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !errors.Is(err, errSentinel) {
		t.Fatal("causa original deve permanecer acessivel via errors.Is")
	}
}

func TestCreateInstance_FalhaConectarRetornaUnavailable(t *testing.T) {
	t.Parallel()
	runner := &fakeRunner{}
	repo := &fakeInstanceRepo{}
	driver := &fakeDriver{connectErr: errSentinel}
	pub := &fakePublisher{}

	_, err := newCreateInstanceUC(runner, repo, driver, pub).Execute(
		context.Background(),
		usecase.CreateInstanceCommand{CompanyID: "c", Name: "x"},
	)
	if err == nil {
		t.Fatal("esperava erro")
	}
	var de *errs.Error
	if !errors.As(err, &de) || de.Kind != errs.KindUnavailable || de.Code != "INSTANCE_CONNECT_FAILED" {
		t.Fatalf("erro inesperado: %v", err)
	}
	// Importante: persistencia E evento ja foram committados antes do Connect falhar.
	if len(repo.created) != 1 || len(pub.instanceCreated) != 1 {
		t.Fatal("estado persistido + evento enfileirado deveriam permanecer mesmo com Connect falhando")
	}
}

// TestCreateInstance_PayloadDoEventoCarregaCreatedAt protege contra
// regressoes silenciosas no payload do InstanceCreatedEvent (consumido
// pelo gateway em G4.2 cenario 1).
func TestCreateInstance_PayloadDoEventoCarregaCreatedAt(t *testing.T) {
	t.Parallel()
	runner := &fakeRunner{}
	repo := &fakeInstanceRepo{}
	pub := &fakePublisher{}

	before := time.Now().UTC().Add(-time.Second)
	_, err := newCreateInstanceUC(runner, repo, &fakeDriver{}, pub).
		Execute(context.Background(), usecase.CreateInstanceCommand{CompanyID: "c", Name: "x"})
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	after := time.Now().UTC().Add(time.Second)

	got := pub.instanceCreated[0].CreatedAt
	if got.Before(before) || got.After(after) {
		t.Fatalf("CreatedAt fora da janela: got=%v before=%v after=%v", got, before, after)
	}
}
