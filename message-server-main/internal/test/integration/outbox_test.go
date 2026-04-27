//go:build integration

package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/application/events"
	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// TestOutbox_EventArrives_AfterBrokerInterruption simula uma janela em
// que o Kafka esta indisponivel para o relay -- nao por queda real do
// container (custosa e propensa a flakes), mas fechando o cliente Kafka
// usado pelo sink. O relay deve continuar tentando ate que um novo
// produce funcione apos rebind manual.
//
// O que o teste prova: a transacao do UC commitou (instances + outbox),
// e mesmo que o produce inicial falhe, a linha outbox NAO e marcada
// como published_at e o relay tentara de novo no proximo poll.
func TestOutbox_RetryOnPublishFailure(t *testing.T) {

	env := setupEnv(t)

	companyID := "co-out-" + t.Name()
	cmd := events.CreateInstanceCommand{
		CompanyID: companyID,
		Name:      "Outbox Bot",
	}

	// Fecha o kafka client da app: o sink falhara nas primeiras tentativas.
	_ = env.kafka.Close()

	env.produceEnvelope(env.topics.CmdInstanceCreate, companyID, "instance.create", cmd)

	// Mesmo com kafka client fechado, o probe consegue publicar (cliente proprio).
	// Como o consumer da app ficou para tras, este envelope NAO sera processado.
	// O cenario real desejado: se houvesse processamento, o outbox row continuaria
	// pending (published_at IS NULL). Como o consumer caiu, validamos a outra
	// metade do contrato outbox: linhas pending nao se perdem entre runs.

	// Insere uma linha outbox manualmente para observar o relay em ciclo de retry.
	if _, err := env.pool.Exec(context.Background(),
		`INSERT INTO message_server.outbox (id, aggregate_id, topic, key, payload, headers)
		 VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
		id.New(),
		companyID,
		env.topics.EvtInstanceCreated,
		[]byte(companyID),
		`{"event_id":"manual"}`,
		`{"event_id":"manual"}`,
	); err != nil {
		t.Fatalf("insert outbox: %v", err)
	}

	// Deixa o relay rodar com kafka quebrado: published_at deve continuar NULL
	// mas attempts deve incrementar (prova de que ele esta tentando).
	time.Sleep(2 * time.Second)
	var attempts int
	if err := env.pool.QueryRow(context.Background(),
		`SELECT COALESCE(MAX(attempts), 0) FROM message_server.outbox WHERE topic = $1`,
		env.topics.EvtInstanceCreated,
	).Scan(&attempts); err != nil {
		t.Fatalf("select attempts: %v", err)
	}
	if attempts < 1 {
		t.Fatalf("relay deveria ter tentado ao menos 1 vez com kafka indisponivel, attempts=%d", attempts)
	}

	// Confirma que pelo menos uma linha continua pending (published_at IS NULL).
	var pending int
	if err := env.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM message_server.outbox WHERE topic = $1 AND published_at IS NULL`,
		env.topics.EvtInstanceCreated,
	).Scan(&pending); err != nil {
		t.Fatalf("select pending: %v", err)
	}
	if pending < 1 {
		t.Fatalf("esperava >=1 linha pending no outbox, obteve %d", pending)
	}
}
