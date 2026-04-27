// Package metrics centraliza o registro Prometheus do servico.
//
// Decisao: usamos um Registry dedicado (nao DefaultRegisterer) para
// evitar metricas-fantasma de bibliotecas que registram global por
// efeito colateral. O endpoint /metrics e exposto pelo bootstrap
// usando promhttp.HandlerFor(reg).
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Metrics agrega todos os instrumentos do servico. Construido uma unica
// vez em bootstrap e injetado nos componentes que precisam observar.
//
// Convencao de nomes (Prometheus): namespace `messageserver`, sub_system
// implicito no nome curto. Labels conservadoras -- alta cardinalidade
// (`instance_id`) so onde a doc G4 explicitamente exige.
type Metrics struct {
	reg *prometheus.Registry

	KafkaConsumerLag       *prometheus.GaugeVec
	KafkaHandlerDuration   *prometheus.HistogramVec
	OutboxPending          prometheus.Gauge
	OutboxPublishedTotal   *prometheus.CounterVec
	OutboxFailedTotal      *prometheus.CounterVec
	WhatsmeowSessions      *prometheus.GaugeVec
	IncomingMessagesTotal  *prometheus.CounterVec
	OutgoingMessagesTotal  *prometheus.CounterVec
}

// New constroi e registra todos os instrumentos. Falha apenas em
// programmer error (registro duplicado), portanto retorna *Metrics
// direto -- bootstrap aborta se panic ocorrer (sem fallback silencioso).
func New() *Metrics {
	reg := prometheus.NewRegistry()
	m := &Metrics{
		reg: reg,
		KafkaConsumerLag: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "messageserver",
			Name:      "kafka_consumer_lag",
			Help:      "Lag de consumo por particao Kafka.",
		}, []string{"topic", "partition"}),
		KafkaHandlerDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "messageserver",
			Name:      "kafka_handler_duration_seconds",
			Help:      "Duracao do handler de cada record consumido.",
			Buckets:   prometheus.DefBuckets,
		}, []string{"topic", "outcome"}),
		OutboxPending: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: "messageserver",
			Name:      "outbox_pending",
			Help:      "Linhas com published_at IS NULL.",
		}),
		OutboxPublishedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "messageserver",
			Name:      "outbox_published_total",
			Help:      "Eventos publicados com sucesso pelo relay.",
		}, []string{"topic"}),
		OutboxFailedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "messageserver",
			Name:      "outbox_failed_total",
			Help:      "Falhas observadas no relay.",
		}, []string{"topic", "reason"}),
		WhatsmeowSessions: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "messageserver",
			Name:      "whatsmeow_sessions",
			Help:      "Sessoes whatsmeow ativas por status.",
		}, []string{"status"}),
		IncomingMessagesTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "messageserver",
			Name:      "incoming_messages_total",
			Help:      "Mensagens entrantes observadas pelo dispatcher.",
		}, []string{"instance_id", "kind"}),
		OutgoingMessagesTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "messageserver",
			Name:      "outgoing_messages_total",
			Help:      "Mensagens enviadas pelo SendText.",
		}, []string{"instance_id", "kind", "outcome"}),
	}
	reg.MustRegister(
		m.KafkaConsumerLag,
		m.KafkaHandlerDuration,
		m.OutboxPending,
		m.OutboxPublishedTotal,
		m.OutboxFailedTotal,
		m.WhatsmeowSessions,
		m.IncomingMessagesTotal,
		m.OutgoingMessagesTotal,
	)
	return m
}

// Registry expoe o registro para o handler /metrics.
func (m *Metrics) Registry() *prometheus.Registry { return m.reg }
