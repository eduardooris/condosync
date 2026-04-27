package events_test

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
)

// O envelope e contrato publico (Kafka). Estes testes blindam o
// schema JSON contra mudancas acidentais que quebrariam consumidores.

func TestEventEnvelope_SerializacaoMantemCamposObrigatorios(t *testing.T) {
	t.Parallel()
	env := events.EventEnvelope[events.InstanceCreatedEvent]{
		EventID:      "evt-1",
		EventType:    "instance.created",
		EventVersion: "1.0",
		OccurredAt:   time.Date(2026, 4, 23, 13, 0, 0, 0, time.UTC),
		Source:       "message-server",
		Payload: events.InstanceCreatedEvent{
			InstanceID: "inst-1",
			CompanyID:  "comp-1",
			Name:       "default",
			CreatedAt:  time.Date(2026, 4, 23, 13, 0, 0, 0, time.UTC),
		},
	}
	body, err := json.Marshal(env)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	s := string(body)
	for _, mustHave := range []string{
		`"event_id":"evt-1"`,
		`"event_type":"instance.created"`,
		`"event_version":"1.0"`,
		`"occurred_at":"2026-04-23T13:00:00Z"`,
		`"source":"message-server"`,
		`"instance_id":"inst-1"`,
	} {
		if !strings.Contains(s, mustHave) {
			t.Errorf("envelope deveria conter %s; obtido: %s", mustHave, s)
		}
	}
}

func TestEventEnvelope_OmitemptyEmCamposOpcionais(t *testing.T) {
	t.Parallel()
	env := events.EventEnvelope[map[string]string]{
		EventID:      "evt-1",
		EventType:    "x",
		EventVersion: "1.0",
		OccurredAt:   time.Unix(0, 0).UTC(),
		Source:       "message-server",
		Payload:      map[string]string{},
	}
	body, _ := json.Marshal(env)
	s := string(body)
	if strings.Contains(s, "correlation_id") {
		t.Errorf("correlation_id vazio nao deveria aparecer no JSON: %s", s)
	}
	if strings.Contains(s, "trace_parent") {
		t.Errorf("trace_parent vazio nao deveria aparecer no JSON: %s", s)
	}
}

func TestEventEnvelope_TraceParentSerializaQuandoPresente(t *testing.T) {
	t.Parallel()
	env := events.EventEnvelope[map[string]string]{
		EventID:      "evt-1",
		EventType:    "x",
		EventVersion: "1.0",
		OccurredAt:   time.Unix(0, 0).UTC(),
		Source:       "message-server",
		TraceParent:  "00-aabbccddeeff00112233445566778899-0011223344556677-01",
		Payload:      map[string]string{},
	}
	body, _ := json.Marshal(env)
	if !strings.Contains(string(body), `"trace_parent":"00-aabbcc`) {
		t.Errorf("trace_parent nao serializado: %s", string(body))
	}
}

func TestInstanceCreatedEvent_PayloadCompleto(t *testing.T) {
	t.Parallel()
	evt := events.InstanceCreatedEvent{
		InstanceID: "inst-1",
		CompanyID:  "comp-1",
		Name:       "default",
		CreatedAt:  time.Date(2026, 4, 23, 13, 0, 0, 0, time.UTC),
	}
	body, _ := json.Marshal(evt)
	for _, mustHave := range []string{
		`"instance_id":"inst-1"`,
		`"company_id":"comp-1"`,
		`"name":"default"`,
		`"created_at":"2026-04-23T13:00:00Z"`,
	} {
		if !strings.Contains(string(body), mustHave) {
			t.Errorf("payload deve conter %s; obtido: %s", mustHave, string(body))
		}
	}
}
