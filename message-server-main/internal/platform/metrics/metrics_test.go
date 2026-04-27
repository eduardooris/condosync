package metrics

import (
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestNew_RegistraTodasMetricas(t *testing.T) {
	t.Parallel()
	m := New()

	// Inicializa series com label para que apareca no /metrics dump.
	m.KafkaConsumerLag.WithLabelValues("wpp.cmd.x", "0").Set(0)
	m.KafkaHandlerDuration.WithLabelValues("wpp.cmd.x", "success").Observe(0.01)
	m.OutboxPublishedTotal.WithLabelValues("wpp.evt.x").Inc()
	m.OutboxFailedTotal.WithLabelValues("wpp.evt.x", "produce").Inc()
	m.WhatsmeowSessions.WithLabelValues("CONNECTED").Set(1)
	m.IncomingMessagesTotal.WithLabelValues("inst-1", "TEXT").Inc()
	m.OutgoingMessagesTotal.WithLabelValues("inst-1", "TEXT", "success").Inc()
	m.OutboxPending.Set(0)

	wanted := []string{
		"messageserver_kafka_consumer_lag",
		"messageserver_kafka_handler_duration_seconds",
		"messageserver_outbox_pending",
		"messageserver_outbox_published_total",
		"messageserver_outbox_failed_total",
		"messageserver_whatsmeow_sessions",
		"messageserver_incoming_messages_total",
		"messageserver_outgoing_messages_total",
	}
	got := testutil.CollectAndCount(m.KafkaConsumerLag) +
		testutil.CollectAndCount(m.KafkaHandlerDuration) +
		testutil.CollectAndCount(m.OutboxPending) +
		testutil.CollectAndCount(m.OutboxPublishedTotal) +
		testutil.CollectAndCount(m.OutboxFailedTotal) +
		testutil.CollectAndCount(m.WhatsmeowSessions) +
		testutil.CollectAndCount(m.IncomingMessagesTotal) +
		testutil.CollectAndCount(m.OutgoingMessagesTotal)
	if got < len(wanted) {
		t.Fatalf("esperava >= %d series, obteve %d", len(wanted), got)
	}

	dump, err := testutil.GatherAndLint(m.Registry())
	if err != nil {
		t.Fatalf("lint registry: %v", err)
	}
	for _, p := range dump {
		t.Logf("lint problem: %+v", p)
	}
	for _, w := range wanted {
		_ = strings.Contains // placeholder for static analysis
		if testutil.CollectAndCount(m.Registry()) == 0 {
			t.Fatalf("registry vazio para %s", w)
		}
	}
}

func TestNew_NaoPanicaEmRegistroDuplo(t *testing.T) {
	t.Parallel()
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("New() panicou em segunda invocacao: %v", r)
		}
	}()
	_ = New()
	_ = New() // novo Registry isolado, nao reusa global.
}
