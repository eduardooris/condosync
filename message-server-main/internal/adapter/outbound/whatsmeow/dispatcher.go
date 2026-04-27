package whatsmeowdriver

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/application/ports"
	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/platform/metrics"
	"github.com/IAtend-LOC/message-server/internal/shared/id"

	waEvents "go.mau.fi/whatsmeow/types/events"
)

// jidResolver expoe ao dispatcher o JID atual de uma sessao para que
// ele consiga gravar (em PairSuccess) e ler (no extract de mensagens
// recebidas) sem importar o pacote whatsmeow inteiro nos testes.
type jidResolver interface {
	JIDOf(instanceID id.ID) (user, server string, ok bool)
}

// Dispatcher centraliza o tratamento de eventos entregues pelo
// whatsmeow. Toda a regra de negocio (transicao de estado, persistencia,
// publicacao) acontece aqui, mantendo o adapter Driver enxuto.
//
// Decisoes a destacar:
//   - Erros NUNCA sao retornados para a goroutine do whatsmeow:
//     logamos e seguimos. Um erro que vaza derruba o event handler e
//     trava todas as instancias do processo.
//   - Panic em um evento e isolado por recover() em Dispatch.
//   - Eventos desconhecidos sao logados em debug -- nao queremos
//     poluir info com dezenas de tipos que ainda nao tratamos.
type Dispatcher struct {
	repo      instance.Repository
	publisher ports.EventPublisher
	ingest    *usecase.IngestIncomingMessage
	jids      jidResolver
	log       logger.Logger
	metrics   *metrics.Metrics
}

// NewDispatcher constroi o dispatcher. metrics pode ser nil em testes.
func NewDispatcher(
	repo instance.Repository,
	publisher ports.EventPublisher,
	ingest *usecase.IngestIncomingMessage,
	jids jidResolver,
	log logger.Logger,
	m *metrics.Metrics,
) *Dispatcher {
	return &Dispatcher{repo: repo, publisher: publisher, ingest: ingest, jids: jids, log: log, metrics: m}
}

// Dispatch despacha um evento bruto do whatsmeow para o handler
// correto. Sempre devolve nil para o caller; falhas viram log.
//
// Antes de delegar, resolve o tenant_id da instancia (instance.CompanyID)
// e injeta no ctx via events.WithTenantID. Isto:
//   - garante que o outbox.Publisher consiga preencher o envelope
//     mesmo em fluxos disparados pelo whatsmeow (logout, connect, msg);
//   - se a instance nao existir mais no nosso DB (ex.: foi deletada
//     mas o whatsmeow store ainda tem o device), mensagens recebidas
//     sao DESCARTADAS para evitar a violacao da FK
//     messages_instance_id_fkey -- que antes vazava como
//     "ingest mensagem falhou ... INSTANCE_NOT_FOUND".
func (d *Dispatcher) Dispatch(ctx context.Context, instanceID id.ID, evt any) {
	defer func() {
		if r := recover(); r != nil {
			d.log.Error(ctx, "dispatcher panic", "instance_id", instanceID, "evt_type", typeName(evt), "panic", fmt.Sprint(r))
		}
	}()

	inst, err := d.repo.FindByID(ctx, instanceID)
	if err != nil {
		d.log.Error(ctx, "dispatcher: lookup instance falhou",
			"instance_id", instanceID, "evt_type", typeName(evt), "err", err.Error())
		return
	}
	if inst == nil {
		// Instance removida do nosso DB porem device whatsmeow ainda
		// existe no sqlstore. Ignoramos qualquer mensagem entrante para
		// nao quebrar a FK; demais eventos tambem nao tem tenant_id
		// para enriquecer o envelope -- log warn e descarta.
		d.log.Warn(ctx, "dispatcher: instance ausente, evento descartado",
			"instance_id", instanceID, "evt_type", typeName(evt))
		return
	}
	ctx = events.WithTenantID(ctx, inst.CompanyID())

	switch e := evt.(type) {
	case *waEvents.Connected:
		d.onConnected(ctx, instanceID)
	case *waEvents.Disconnected:
		d.onDisconnected(ctx, instanceID)
	case *waEvents.LoggedOut:
		d.onLoggedOut(ctx, instanceID, e)
	case *waEvents.PairSuccess:
		d.onPairSuccess(ctx, instanceID, e)
	case *waEvents.QR:
		// QR e consumido pelo canal dedicado em Driver.Connect.
	case *waEvents.Message:
		d.onMessage(ctx, instanceID, e)
	default:
		d.log.Debug(ctx, "evento whatsmeow ignorado", "instance_id", instanceID, "evt_type", typeName(evt))
	}
}

func (d *Dispatcher) onConnected(ctx context.Context, instanceID id.ID) {
	if err := d.repo.UpdateStatus(ctx, instanceID, instance.StatusConnected); err != nil {
		d.log.Error(ctx, "atualizar status connected falhou", "instance_id", instanceID, "err", err.Error())
	}
	d.transitionGauge(string(instance.StatusConnected))
	if err := d.publisher.PublishConnectionUpdated(ctx, events.ConnectionUpdatedEvent{
		InstanceID: instanceID,
		Status:     string(instance.StatusConnected),
	}); err != nil {
		d.log.Error(ctx, "publicar conexao falhou", "instance_id", instanceID, "err", err.Error())
	}
}

func (d *Dispatcher) onDisconnected(ctx context.Context, instanceID id.ID) {
	if err := d.repo.UpdateStatus(ctx, instanceID, instance.StatusDisconnected); err != nil {
		d.log.Error(ctx, "atualizar status disconnected falhou", "instance_id", instanceID, "err", err.Error())
	}
	d.transitionGauge(string(instance.StatusDisconnected))
	if err := d.publisher.PublishConnectionUpdated(ctx, events.ConnectionUpdatedEvent{
		InstanceID: instanceID,
		Status:     string(instance.StatusDisconnected),
	}); err != nil {
		d.log.Error(ctx, "publicar conexao falhou", "instance_id", instanceID, "err", err.Error())
	}
}

func (d *Dispatcher) onLoggedOut(ctx context.Context, instanceID id.ID, e *waEvents.LoggedOut) {
	reason := ""
	if e != nil {
		reason = e.Reason.String()
	}
	if err := d.repo.UpdateStatus(ctx, instanceID, instance.StatusLoggedOut); err != nil {
		d.log.Error(ctx, "atualizar status logged_out falhou", "instance_id", instanceID, "err", err.Error())
	}
	d.transitionGauge(string(instance.StatusLoggedOut))
	if err := d.publisher.PublishConnectionUpdated(ctx, events.ConnectionUpdatedEvent{
		InstanceID: instanceID,
		Status:     string(instance.StatusLoggedOut),
		Reason:     reason,
	}); err != nil {
		d.log.Error(ctx, "publicar logout falhou", "instance_id", instanceID, "err", err.Error())
	}
}

func (d *Dispatcher) onPairSuccess(ctx context.Context, instanceID id.ID, e *waEvents.PairSuccess) {
	if e == nil {
		return
	}
	jid := e.ID.String()
	if err := d.repo.UpdateWhatsmeowJID(ctx, instanceID, jid); err != nil {
		d.log.Error(ctx, "persistir JID apos pareamento falhou", "instance_id", instanceID, "jid", jid, "err", err.Error())
	}
	if err := d.repo.UpdateStatus(ctx, instanceID, instance.StatusConnecting); err != nil {
		d.log.Error(ctx, "atualizar status connecting apos pair falhou", "instance_id", instanceID, "err", err.Error())
	}
}

func (d *Dispatcher) onMessage(ctx context.Context, instanceID id.ID, e *waEvents.Message) {
	if e == nil || e.Message == nil {
		return
	}
	body := extractText(e)
	if body == "" {
		d.log.Debug(ctx, "tipo de mensagem nao suportado", "instance_id", instanceID, "wpp_id", e.Info.ID)
		return
	}

	to := ""
	if d.jids != nil {
		if user, server, ok := d.jids.JIDOf(instanceID); ok {
			to = user + "@" + server
		}
	}

	cmd := usecase.IngestIncomingMessageCommand{
		InstanceID: instanceID,
		WppID:      e.Info.ID,
		From:       e.Info.Sender.String(),
		To:         to,
		Body:       body,
		Timestamp:  e.Info.Timestamp,
		FromMe:     e.Info.IsFromMe,
	}
	if err := d.ingest.Execute(ctx, cmd); err != nil {
		d.log.Error(ctx, "ingest mensagem falhou", "instance_id", instanceID, "wpp_id", e.Info.ID, "err", err.Error())
		return
	}
	if d.metrics != nil {
		d.metrics.IncomingMessagesTotal.WithLabelValues(string(instanceID), "TEXT").Inc()
	}
}

// extractText cobre os dois tipos de mensagem suportados em G3:
// Conversation (texto puro) e ExtendedTextMessage (texto com quoted/preview).
// Outros tipos retornam "" e o dispatcher faz skip silencioso.
func extractText(e *waEvents.Message) string {
	if c := e.Message.GetConversation(); c != "" {
		return c
	}
	if ext := e.Message.GetExtendedTextMessage(); ext != nil {
		return ext.GetText()
	}
	return ""
}

func typeName(v any) string {
	if v == nil {
		return "<nil>"
	}
	return reflect.TypeOf(v).String()
}

// dispatchTimeout limita o tempo gasto por um unico handler de evento.
// Evita que um problema de DB (ex.: lock) trave o event loop por uma
// instancia inteira.
const dispatchTimeout = 30 * time.Second

// withTimeout devolve um ctx com timeout padrao usado por todos os
// handlers chamados a partir de Dispatch.
func withTimeout(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, dispatchTimeout)
}

// transitionGauge incrementa o status novo. O decremento do anterior
// e feito implicitamente pelo Prometheus (gauge cumulativo): manter
// totais por status e suficiente para o painel agregado de G4.
func (d *Dispatcher) transitionGauge(status string) {
	if d.metrics == nil {
		return
	}
	d.metrics.WhatsmeowSessions.WithLabelValues(status).Inc()
}
