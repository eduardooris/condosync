//go:build integration

package integration_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
)

// TestCreateInstance_EndToEnd verifica o caminho ponta-a-ponta:
//
//   produce(CmdInstanceCreate) -> handler -> CreateInstance UC ->
//   instances row + outbox row -> relay -> EvtInstanceCreated topic.
func TestCreateInstance_EndToEnd(t *testing.T) {

	env := setupEnv(t)

	companyID := "co-" + t.Name()
	cmd := events.CreateInstanceCommand{
		CompanyID: companyID,
		Name:      "Integration Bot",
	}

	env.produceEnvelope(env.topics.CmdInstanceCreate, companyID, "instance.create", cmd)

	// 1. instances row aparece.
	eventually(t, 30*time.Second, func() bool {
		var n int
		err := env.pool.QueryRow(context.Background(),
			`SELECT COUNT(*) FROM message_server.instances WHERE company_id = $1`,
			companyID,
		).Scan(&n)
		return err == nil && n == 1
	})

	// 2. evento publicado no topico EvtInstanceCreated.
	recs := env.consume(env.topics.EvtInstanceCreated, 1, 30*time.Second)
	if len(recs) < 1 {
		t.Fatalf("esperava >=1 evento em %s, obteve %d", env.topics.EvtInstanceCreated, len(recs))
	}

	var env0 events.EventEnvelope[events.InstanceCreatedEvent]
	if err := json.Unmarshal(recs[0].Value, &env0); err != nil {
		t.Fatalf("unmarshal evento: %v", err)
	}
	if env0.Payload.CompanyID != companyID {
		t.Fatalf("company_id divergente: got %q want %q", env0.Payload.CompanyID, companyID)
	}
	if env0.EventID == "" {
		t.Fatal("event_id vazio no envelope publicado")
	}
}
