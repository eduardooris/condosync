//go:build integration

// Package integration_test sobe Postgres + Redpanda reais via
// testcontainers e exercita os caminhos criticos end-to-end.
//
// O setup deliberadamente NAO usa bootstrap.New porque substitui o
// driver whatsmeow real por um stub controlavel. Compoem-se as mesmas
// pecas que bootstrap.New monta, exceto whatsmeow.NewContainer +
// whatsmeow.New.
package integration_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	inboundkafka "github.com/IAtend-LOC/message-server/internal/adapter/inbound/kafka"
	"github.com/IAtend-LOC/message-server/internal/adapter/outbound/kafkasink"
	"github.com/IAtend-LOC/message-server/internal/adapter/outbound/outbox"
	postgresrepo "github.com/IAtend-LOC/message-server/internal/adapter/outbound/postgres"
	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/config"
	"github.com/IAtend-LOC/message-server/internal/domain/instance"
	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/platform/metrics"
	pgxlib "github.com/IAtend-LOC/message-server/internal/platform/postgres"
	pgxmigrate "github.com/IAtend-LOC/message-server/internal/platform/postgres/migrate"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/tx"
	"github.com/IAtend-LOC/message-server/internal/shared/id"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	tcredpanda "github.com/testcontainers/testcontainers-go/modules/redpanda"
	"github.com/twmb/franz-go/pkg/kgo"
)

// testEnv agrega tudo o que um teste precisa: clientes, pool, helpers
// para produzir/consumir, e cleanup garantido.
type testEnv struct {
	t           *testing.T
	pool        *pgxpool.Pool
	kafka       *kafka.Client
	probe       *kgo.Client // cliente isolado para produzir/consumir nos topicos.
	probeBroker string
	topics      config.KafkaTopics
	driver      *stubDriver
	cancel      context.CancelFunc
	wg          *sync.WaitGroup
	cleanupFns  []func()
}

// setupEnv sobe Postgres + Redpanda, aplica migrations, monta o grafo
// de componentes e inicia goroutines de consumer + relay. O cleanup
// retornado encerra tudo na ordem correta.
func setupEnv(t *testing.T) *testEnv {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	t.Cleanup(cancel)

	log := logger.New("error")

	// 1. Postgres container.
	pgCtr, err := tcpostgres.Run(ctx, "postgres:16-alpine",
		tcpostgres.WithDatabase("integration"),
		tcpostgres.WithUsername("integration"),
		tcpostgres.WithPassword("integration"),
		tcpostgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Fatalf("postgres container: %v", err)
	}
	pgHost, err := pgCtr.Host(ctx)
	if err != nil {
		t.Fatalf("postgres host: %v", err)
	}
	pgPort, err := pgCtr.MappedPort(ctx, "5432/tcp")
	if err != nil {
		t.Fatalf("postgres port: %v", err)
	}

	// 2. Redpanda container.
	rpCtr, err := tcredpanda.Run(ctx, "docker.redpanda.com/redpandadata/redpanda:v24.2.4",
		tcredpanda.WithAutoCreateTopics(),
	)
	if err != nil {
		t.Fatalf("redpanda container: %v", err)
	}
	brokers, err := rpCtr.KafkaSeedBroker(ctx)
	if err != nil {
		t.Fatalf("redpanda broker: %v", err)
	}

	cleanupFns := []func(){
		func() { _ = testcontainers.TerminateContainer(rpCtr) },
		func() { _ = testcontainers.TerminateContainer(pgCtr) },
	}

	// 3. Pool + migrations.
	dbCfg := config.Database{
		Host:     pgHost,
		Port:     int(pgPort.Num()),
		Name:     "integration",
		User:     "integration",
		Password: "integration",
		SSLMode:  "disable",
		MaxConns: 10,
	}
	pool, err := pgxlib.New(ctx, dbCfg, log)
	if err != nil {
		runCleanup(cleanupFns)
		t.Fatalf("pool: %v", err)
	}
	cleanupFns = append([]func(){func() { pool.Close() }}, cleanupFns...)

	migDir := filepath.Join(repoRoot(t), "migrations")
	if err := pgxmigrate.Run(ctx, dbCfg.DSN(), migDir, log); err != nil {
		runCleanup(cleanupFns)
		t.Fatalf("migrate: %v", err)
	}

	// 4. Topicos exclusivos por teste para evitar cross-talk.
	topics := newTopics(t.Name())
	probeBrokerHost := brokers
	if _, _, err := net.SplitHostPort(brokers); err != nil {
		probeBrokerHost = brokers + ":9092"
	}

	// 5. Cliente Kafka da aplicacao.
	kc, err := kafka.New(kafka.Config{
		Brokers:       []string{probeBrokerHost},
		ClientID:      "ms-it-" + id.New()[:8],
		ConsumerGroup: "ms-it-grp-" + id.New()[:8],
		Topics:        topics.InboundTopics(),
	}, log)
	if err != nil {
		runCleanup(cleanupFns)
		t.Fatalf("kafka client: %v", err)
	}
	cleanupFns = append([]func(){func() { _ = kc.Close() }}, cleanupFns...)

	// 6. Probe Kafka client (produz/consume nos topicos diretamente).
	probe, err := kgo.NewClient(
		kgo.SeedBrokers(probeBrokerHost),
		kgo.AllowAutoTopicCreation(),
	)
	if err != nil {
		runCleanup(cleanupFns)
		t.Fatalf("probe kafka client: %v", err)
	}
	cleanupFns = append([]func(){probe.Close}, cleanupFns...)

	// 7. Wiring (espelha bootstrap.New, sem whatsmeow real).
	m := metrics.New()
	txm := tx.NewManager(pool, log)
	sink := kafkasink.New(kc)
	outboxPub := outbox.NewPublisher(pool, topics)
	recorder := outbox.NewRecorder(pool)
	relay := outbox.NewRelay(pool, sink, log, m, 50, 100*time.Millisecond)

	instanceRepo := postgresrepo.NewInstanceRepository(pool)
	driver := newStubDriver()
	createUC := usecase.NewCreateInstance(txm, instanceRepo, driver, outboxPub)
	sendUC := usecase.NewSendTextMessage(txm, instanceRepo, driver, outboxPub)
	router := inboundkafka.New(log, topics, createUC, sendUC, m)
	router.Register(kc, recorder, txm, m)

	// 8. Goroutines de consumer + relay.
	runCtx, runCancel := context.WithCancel(context.Background())
	wg := &sync.WaitGroup{}
	wg.Add(2)
	go func() { defer wg.Done(); _ = kc.Run(runCtx) }()
	go func() { defer wg.Done(); _ = relay.Run(runCtx) }()

	env := &testEnv{
		t:           t,
		pool:        pool,
		kafka:       kc,
		probe:       probe,
		probeBroker: probeBrokerHost,
		topics:      topics,
		driver:      driver,
		cancel:      runCancel,
		wg:          wg,
		cleanupFns:  cleanupFns,
	}
	t.Cleanup(env.shutdown)
	return env
}

func (e *testEnv) shutdown() {
	e.cancel()
	done := make(chan struct{})
	go func() { e.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		e.t.Logf("timeout aguardando goroutines")
	}
	runCleanup(e.cleanupFns)
}

func runCleanup(fns []func()) {
	for _, fn := range fns {
		fn()
	}
}

func newTopics(testName string) config.KafkaTopics {
	suffix := id.New()[:8]
	mk := func(kind string) string {
		return "wpp.it." + suffix + "." + kind + ".v1"
	}
	return config.KafkaTopics{
		CmdInstanceCreate:     mk("cmd.instance.create"),
		CmdInstanceDelete:     mk("cmd.instance.delete"),
		CmdMessageSendText:    mk("cmd.message.send-text"),
		EvtInstanceCreated:    mk("evt.instance.created"),
		EvtInstanceQRCode:     mk("evt.instance.qrcode"),
		EvtInstanceConnection: mk("evt.instance.connection"),
		EvtMessageReceived:    mk("evt.message.received"),
		EvtMessageSent:        mk("evt.message.sent"),
	}
}

// repoRoot localiza a raiz do repo a partir do arquivo deste pacote.
func repoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller falhou")
	}
	// internal/test/integration/setup_test.go -> sobe 3 niveis ate o repo.
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", ".."))
}

// produceEnvelope envelopa um payload em events.EventEnvelope, gera
// event_id, serializa e produz com header event_id correspondente.
// Retorna o event_id gerado para que o teste possa reaproveita-lo.
func (e *testEnv) produceEnvelope(topic, key, eventType string, payload any) string {
	e.t.Helper()
	eventID := id.New()
	body, err := jsonMarshalEnvelope(eventID, eventType, payload)
	if err != nil {
		e.t.Fatalf("marshal envelope: %v", err)
	}
	e.produceRaw(topic, key, eventID, body)
	return eventID
}

// jsonMarshalEnvelope monta um envelope JSON identico ao formato emitido
// pelo publisher real. Disponivel a todos os testes do pacote.
func jsonMarshalEnvelope(eventID, eventType string, payload any) ([]byte, error) {
	env := map[string]any{
		"event_id":      eventID,
		"event_type":    eventType,
		"event_version": "1.0",
		"occurred_at":   time.Now().UTC().Format(time.RFC3339Nano),
		"source":        "integration-test",
		"payload":       payload,
	}
	return json.Marshal(env)
}

// produceRaw publica um corpo ja serializado, reutilizando o event_id no header.
func (e *testEnv) produceRaw(topic, key, eventID string, body []byte) {
	e.t.Helper()
	rec := &kgo.Record{
		Topic: topic,
		Key:   []byte(key),
		Value: body,
		Headers: []kgo.RecordHeader{
			{Key: "event_id", Value: []byte(eventID)},
		},
	}
	if err := e.probe.ProduceSync(context.Background(), rec).FirstErr(); err != nil {
		e.t.Fatalf("produce: %v", err)
	}
}

// consume puxa registros de um topico ate atingir wantCount ou timeout.
// Cria um cliente isolado por chamada para nao competir com o consumer
// principal da app (que pertence a outro group).
func (e *testEnv) consume(topic string, wantCount int, timeout time.Duration) []*kgo.Record {
	e.t.Helper()
	cli, err := kgo.NewClient(
		kgo.SeedBrokers(e.probeBroker),
		kgo.ConsumerGroup("probe-"+id.New()[:8]),
		kgo.ConsumeTopics(topic),
		kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()),
	)
	if err != nil {
		e.t.Fatalf("consume client: %v", err)
	}
	defer cli.Close()

	deadline := time.Now().Add(timeout)
	var collected []*kgo.Record
	for time.Now().Before(deadline) && len(collected) < wantCount {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		fetches := cli.PollFetches(ctx)
		cancel()
		fetches.EachRecord(func(r *kgo.Record) {
			collected = append(collected, r)
		})
	}
	return collected
}

// eventually executa fn ate retornar true ou estourar timeout.
func eventually(t *testing.T, timeout time.Duration, fn func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("eventually: condicao nao satisfeita dentro do timeout")
}

// stubDriver implementa instance.Driver sem contatar o WhatsApp real.
//
// Connect: armazena instanceID. SendText: incrementa contador, retorna
// wpp_id deterministico baseado em uuid -- suficiente para auditar
// persistencia/eventos sem rede.
type stubDriver struct {
	mu             sync.Mutex
	connected      []id.ID
	sentRecipients []string
}

func newStubDriver() *stubDriver { return &stubDriver{} }

func (s *stubDriver) Connect(ctx context.Context, inst *instance.Instance) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.connected = append(s.connected, inst.ID())
	return nil
}

func (s *stubDriver) Disconnect(ctx context.Context, instanceID id.ID) error { return nil }
func (s *stubDriver) Logout(ctx context.Context, instanceID id.ID) error     { return nil }

func (s *stubDriver) SendText(ctx context.Context, instanceID id.ID, to, body string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sentRecipients = append(s.sentRecipients, to)
	return "WPP_" + id.New(), nil
}

// fmtID e usado em mensagens de erro.
func fmtID(v any) string { return fmt.Sprintf("%v", v) }
