// Package memoryrepo fornece uma implementacao in-memory dos
// repositorios de dominio. Destinada exclusivamente a testes e
// bootstrapping inicial - sera substituida por uma implementacao
// Postgres (pgx) na proxima iteracao.
package memoryrepo

import (
	"context"
	"sync"

	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// InstanceRepository e a implementacao in-memory de instance.Repository.
type InstanceRepository struct {
	mu      sync.RWMutex
	byID    map[id.ID]*instance.Instance
	byOwner map[string]id.ID
}

func NewInstanceRepository() *InstanceRepository {
	return &InstanceRepository{
		byID:    make(map[id.ID]*instance.Instance),
		byOwner: make(map[string]id.ID),
	}
}

func (r *InstanceRepository) Create(_ context.Context, inst *instance.Instance) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.byOwner[inst.CompanyID()]; ok {
		return errs.New(errs.KindConflict, "INSTANCE_ALREADY_EXISTS", "empresa ja possui instancia ativa")
	}
	r.byID[inst.ID()] = inst
	r.byOwner[inst.CompanyID()] = inst.ID()
	return nil
}

func (r *InstanceRepository) FindByID(_ context.Context, instanceID id.ID) (*instance.Instance, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[instanceID], nil
}

func (r *InstanceRepository) FindByCompany(_ context.Context, companyID string) (*instance.Instance, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	id, ok := r.byOwner[companyID]
	if !ok {
		return nil, nil
	}
	return r.byID[id], nil
}

func (r *InstanceRepository) UpdateStatus(_ context.Context, instanceID id.ID, status instance.Status) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	inst, ok := r.byID[instanceID]
	if !ok {
		return errs.New(errs.KindNotFound, "INSTANCE_NOT_FOUND", "instancia nao encontrada")
	}
	inst.TransitionTo(status)
	return nil
}

// ListAll devolve todas as instancias na ordem de insercao indeterminada.
func (r *InstanceRepository) ListAll(_ context.Context) ([]*instance.Instance, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*instance.Instance, 0, len(r.byID))
	for _, v := range r.byID {
		out = append(out, v)
	}
	return out, nil
}

// UpdateWhatsmeowJID nao tem suporte completo na memoria (a entidade
// nao expoe setter), mas mantemos a assinatura para satisfazer o port.
// Implementacoes em-memoria sao destinadas apenas a testes unitarios
// que nao exercitam pareamento real.
func (r *InstanceRepository) UpdateWhatsmeowJID(_ context.Context, instanceID id.ID, jid string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	inst, ok := r.byID[instanceID]
	if !ok {
		return errs.New(errs.KindNotFound, "INSTANCE_NOT_FOUND", "instancia nao encontrada")
	}
	// Re-hidrata para refletir o JID novo (memoryrepo so suporta troca
	// completa do agregado).
	r.byID[instanceID] = instance.Hydrate(
		inst.ID(), inst.CompanyID(), inst.Name(), inst.Status(),
		jid, inst.CreatedAt(), inst.UpdatedAt(),
	)
	return nil
}

func (r *InstanceRepository) Delete(_ context.Context, instanceID id.ID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	inst, ok := r.byID[instanceID]
	if !ok {
		return nil
	}
	delete(r.byID, instanceID)
	delete(r.byOwner, inst.CompanyID())
	return nil
}
