//go:build integration

package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
)

// TestInbox_DuplicateEventID_IsIdempotent garante que reentregas com o
// mesmo event_id resultem em UMA unica linha em instances e UM unico
// evento em EvtInstanceCreated. Cobre G2 (inbox) + G4 (visibilidade).
func TestInbox_DuplicateEventID_IsIdempotent(t *testing.T) {

	env := setupEnv(t)

	companyID := "co-dup-" + t.Name()
	cmd := events.CreateInstanceCommand{
		CompanyID: companyID,
		Name:      "Dedup Bot",
	}

	// Mesmo event_id repetido tres vezes via produceRaw com corpo identico.
	eventID := env.produceEnvelope(env.topics.CmdInstanceCreate, companyID, "instance.create", cmd)
	// Recupera o body original do produce (montamos manualmente para garantir equivalencia).
	body := mustEnvelopeBody(t, eventID, "instance.create", cmd)
	env.produceRaw(env.topics.CmdInstanceCreate, companyID, eventID, body)
	env.produceRaw(env.topics.CmdInstanceCreate, companyID, eventID, body)

	// Aguarda persistencia da primeira execucao.
	eventually(t, 30*time.Second, func() bool {
		var n int
		err := env.pool.QueryRow(context.Background(),
			`SELECT COUNT(*) FROM message_server.instances WHERE company_id = $1`,
			companyID,
		).Scan(&n)
		return err == nil && n == 1
	})

	// Janela curta para garantir que reprocessamentos nao criariam linhas extras.
	time.Sleep(2 * time.Second)

	var instCount int
	if err := env.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM message_server.instances WHERE company_id = $1`,
		companyID,
	).Scan(&instCount); err != nil {
		t.Fatalf("count instances: %v", err)
	}
	if instCount != 1 {
		t.Fatalf("inbox deveria evitar duplicatas: instances=%d, esperado=1", instCount)
	}

	// inbox tem exatamente 1 linha para esse event_id.
	var inboxCount int
	if err := env.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM message_server.inbox WHERE event_id = $1`,
		eventID,
	).Scan(&inboxCount); err != nil {
		t.Fatalf("count inbox: %v", err)
	}
	if inboxCount != 1 {
		t.Fatalf("inbox deveria ter 1 linha por event_id, obteve %d", inboxCount)
	}

	// outbox emitiu apenas 1 evento (publicado).
	var outboxCount int
	if err := env.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM message_server.outbox WHERE topic = $1`,
		env.topics.EvtInstanceCreated,
	).Scan(&outboxCount); err != nil {
		t.Fatalf("count outbox: %v", err)
	}
	if outboxCount != 1 {
		t.Fatalf("outbox deveria ter 1 evento, obteve %d", outboxCount)
	}
}

func mustEnvelopeBody(t *testing.T, eventID, eventType string, payload any) []byte {
	t.Helper()
	body, err := jsonMarshalEnvelope(eventID, eventType, payload)
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}
	return body
}
