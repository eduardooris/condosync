package whatsmeowdriver

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/application/ports"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	dErrs "github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/IAtend-LOC/message-server/internal/shared/id"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// sendTimeout limita o tempo gasto numa unica chamada SendText.
const sendTimeout = 30 * time.Second

// Driver implementa instance.Driver usando whatsmeow.
//
// Multi-tenant em-processo: mantem um *whatsmeow.Client por instancia
// (mapa protegido por RWMutex). Eventos emitidos pela lib sao roteados
// para o Dispatcher injetado.
type Driver struct {
	container  *sqlstore.Container
	repo       instance.Repository
	publisher  ports.EventPublisher
	dispatcher *Dispatcher
	log        logger.Logger

	mu       sync.RWMutex
	sessions map[id.ID]*sessionState
}

type sessionState struct {
	client *whatsmeow.Client
}

// New constroi o driver. O Dispatcher pode ser injetado depois via
// SetDispatcher (resolve a dependencia circular Driver <-> Dispatcher).
func New(container *sqlstore.Container, repo instance.Repository, publisher ports.EventPublisher, log logger.Logger) *Driver {
	return &Driver{
		container: container,
		repo:      repo,
		publisher: publisher,
		log:       log,
		sessions:  make(map[id.ID]*sessionState),
	}
}

// SetDispatcher fecha o ciclo Driver <-> Dispatcher.
func (d *Driver) SetDispatcher(dp *Dispatcher) { d.dispatcher = dp }

// JIDOf implementa jidResolver.
func (d *Driver) JIDOf(instanceID id.ID) (string, string, bool) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	s, ok := d.sessions[instanceID]
	if !ok || s.client.Store == nil || s.client.Store.ID == nil {
		return "", "", false
	}
	return s.client.Store.ID.User, s.client.Store.ID.Server, true
}

// Connect abre/garante a sessao whatsmeow para a instancia.
func (d *Driver) Connect(ctx context.Context, inst *instance.Instance) error {
	if d.dispatcher == nil {
		return fmt.Errorf("whatsmeow.Connect: dispatcher nao injetado")
	}

	d.mu.RLock()
	if s, ok := d.sessions[inst.ID()]; ok && s.client.IsConnected() {
		d.mu.RUnlock()
		return nil
	}
	d.mu.RUnlock()

	device, err := d.deviceFor(ctx, inst)
	if err != nil {
		return err
	}

	client := whatsmeow.NewClient(device, NewWaLogger(d.log).Sub("Client"))
	client.EnableAutoReconnect = true

	instanceID := inst.ID()
	client.AddEventHandler(func(evt any) {
		hctx, cancel := withTimeout(context.Background())
		defer cancel()
		d.dispatcher.Dispatch(hctx, instanceID, evt)
	})

	d.mu.Lock()
	d.sessions[instanceID] = &sessionState{client: client}
	d.mu.Unlock()

	// Caminho 1: device ainda nao pareado -> consumir QR antes/durante Connect.
	if device.ID == nil {
		qrCh, err := client.GetQRChannel(context.Background())
		if err != nil {
			return fmt.Errorf("whatsmeow.Connect: GetQRChannel: %w", err)
		}
		if err := client.Connect(); err != nil {
			return fmt.Errorf("whatsmeow.Connect: %w", err)
		}
		go d.consumeQR(instanceID, qrCh)
		return nil
	}

	// Caminho 2: ja pareado.
	if err := client.Connect(); err != nil {
		return fmt.Errorf("whatsmeow.Connect: %w", err)
	}
	return nil
}

func (d *Driver) deviceFor(ctx context.Context, inst *instance.Instance) (*store.Device, error) {
	jidStr := inst.WhatsmeowJID()
	if jidStr == "" {
		return d.container.NewDevice(), nil
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow.Connect: parse JID %q: %w", jidStr, err)
	}
	dev, err := d.container.GetDevice(ctx, jid)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow.Connect: GetDevice: %w", err)
	}
	if dev == nil {
		d.log.Warn(ctx, "device whatsmeow ausente no sqlstore, reiniciando pareamento",
			"instance_id", inst.ID(), "jid", jidStr)
		return d.container.NewDevice(), nil
	}
	return dev, nil
}

// consumeQR drena o canal de QR publicando um evento por code.
func (d *Driver) consumeQR(instanceID id.ID, ch <-chan whatsmeow.QRChannelItem) {
	for item := range ch {
		switch item.Event {
		case "code":
			expires := time.Now().Add(item.Timeout).UTC()
			ctx, cancel := withTimeout(context.Background())
			// Resolve tenant_id (== company_id) para enriquecer o
			// envelope. Sem isto o outbox.Publisher rejeita o evento.
			inst, ferr := d.repo.FindByID(ctx, instanceID)
			if ferr != nil || inst == nil {
				d.log.Error(ctx, "publicar QR abortado: instance ausente",
					"instance_id", instanceID)
				cancel()
				continue
			}
			pctx := events.WithTenantID(ctx, inst.CompanyID())
			if err := d.publisher.PublishQRCodeUpdated(pctx, events.QRCodeUpdatedEvent{
				InstanceID: instanceID,
				Code:       item.Code,
				ExpiresAt:  expires,
			}); err != nil {
				d.log.Error(ctx, "publicar QR falhou", "instance_id", instanceID, "err", err.Error())
			}
			cancel()
		case "success":
			d.log.Info(context.Background(), "pareamento concluido", "instance_id", instanceID)
		case "timeout":
			d.log.Warn(context.Background(), "QR expirou sem pareamento", "instance_id", instanceID)
		default:
			if item.Error != nil {
				d.log.Error(context.Background(), "erro no canal QR",
					"instance_id", instanceID, "err", item.Error.Error())
			}
		}
	}
}

// Disconnect encerra a sessao mantendo a credencial.
func (d *Driver) Disconnect(ctx context.Context, instanceID id.ID) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	s, ok := d.sessions[instanceID]
	if !ok {
		return nil
	}
	s.client.Disconnect()
	delete(d.sessions, instanceID)
	return nil
}

// Logout encerra a sessao e revoga a credencial no servidor WhatsApp.
func (d *Driver) Logout(ctx context.Context, instanceID id.ID) error {
	d.mu.Lock()
	s, ok := d.sessions[instanceID]
	d.mu.Unlock()
	if !ok {
		return nil
	}
	if err := s.client.Logout(ctx); err != nil {
		return fmt.Errorf("whatsmeow.Logout: %w", err)
	}
	d.mu.Lock()
	delete(d.sessions, instanceID)
	d.mu.Unlock()
	return nil
}

// SendText envia uma mensagem de texto e devolve o ID server-assigned.
func (d *Driver) SendText(ctx context.Context, instanceID id.ID, to, body string) (string, error) {
	d.mu.RLock()
	s, ok := d.sessions[instanceID]
	d.mu.RUnlock()
	if !ok {
		return "", dErrs.New(dErrs.KindUnavailable, "INSTANCE_NOT_CONNECTED", "instancia sem sessao ativa")
	}
	if !s.client.IsLoggedIn() {
		return "", dErrs.New(dErrs.KindUnavailable, "INSTANCE_NOT_LOGGED_IN", "instancia nao autenticada")
	}

	jid, err := parseRecipient(to)
	if err != nil {
		return "", err
	}

	sctx, cancel := context.WithTimeout(ctx, sendTimeout)
	defer cancel()

	resp, err := s.client.SendMessage(sctx, jid, &waProto.Message{
		Conversation: proto.String(body),
	})
	if err != nil {
		return "", mapSendError(err)
	}
	return resp.ID, nil
}

// RecoverSessions reabre todas as sessoes que estavam pareadas antes do
// restart (instancias com whatsmeow_jid != ”). Falhas individuais
// viram log; o operador pode reconectar manualmente.
func (d *Driver) RecoverSessions(ctx context.Context) error {
	insts, err := d.repo.ListAll(ctx)
	if err != nil {
		return fmt.Errorf("whatsmeow.RecoverSessions: list: %w", err)
	}
	recovered := 0
	for _, inst := range insts {
		if inst.WhatsmeowJID() == "" {
			continue
		}
		if err := d.Connect(ctx, inst); err != nil {
			d.log.Error(ctx, "recover sessao falhou", "instance_id", inst.ID(), "err", err.Error())
			continue
		}
		recovered++
	}
	d.log.Info(ctx, "sessoes whatsmeow recuperadas", "count", recovered, "total", len(insts))
	return nil
}

func mapSendError(err error) error {
	if errors.Is(err, whatsmeow.ErrNotConnected) || errors.Is(err, whatsmeow.ErrNotLoggedIn) {
		return dErrs.Wrap(dErrs.KindUnavailable, "INSTANCE_NOT_CONNECTED", "sessao indisponivel", err)
	}
	return dErrs.Wrap(dErrs.KindUnavailable, "MESSAGE_SEND_FAILED", "falha ao enviar mensagem", err)
}
