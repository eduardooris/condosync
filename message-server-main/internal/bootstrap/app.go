// Package bootstrap conecta todas as camadas da aplicacao em um App
// imutavel e pronto para Run().
//
// E o UNICO lugar autorizado a instanciar implementacoes concretas
// (kafka, whatsmeow, repositorios, pool postgres). O resto do codigo
// so conhece ports.
package bootstrap

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	inboundhttp "github.com/IAtend-LOC/message-server/internal/adapter/inbound/http"
	inboundkafka "github.com/IAtend-LOC/message-server/internal/adapter/inbound/kafka"
	"github.com/IAtend-LOC/message-server/internal/adapter/outbound/kafkasink"
	"github.com/IAtend-LOC/message-server/internal/adapter/outbound/outbox"
	postgresrepo "github.com/IAtend-LOC/message-server/internal/adapter/outbound/postgres"
	"github.com/IAtend-LOC/message-server/internal/adapter/outbound/webhooksink"
	whatsmeowdriver "github.com/IAtend-LOC/message-server/internal/adapter/outbound/whatsmeow"
	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/config"
	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/platform/metrics"
	pgxlib "github.com/IAtend-LOC/message-server/internal/platform/postgres"
	pgxmigrate "github.com/IAtend-LOC/message-server/internal/platform/postgres/migrate"
	"github.com/IAtend-LOC/message-server/internal/platform/postgres/tx"
	"github.com/IAtend-LOC/message-server/internal/platform/tracing"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.mau.fi/whatsmeow/store/sqlstore"
)

const (
	healthPingTimeout = 2 * time.Second
	migrationsDirEnv  = "MIGRATIONS_DIR"
	defaultMigrations = "migrations"
	servicVersion     = "0.5.0"
)

// App agrega componentes de longa vida da aplicacao.
type App struct {
	cfg          *config.Config
	log          logger.Logger
	pool         *pgxpool.Pool
	kafka        *kafka.Client
	relay        *outbox.Relay
	httpSv       *http.Server
	metricsSv    *http.Server
	driver       *whatsmeowdriver.Driver
	waCont       *sqlstore.Container
	tracingDown  tracing.Shutdown
}

// New monta o grafo de dependencias.
func New(cfg *config.Config, log logger.Logger) (*App, error) {
	ctx := context.Background()

	// G4: tracing antes de tudo para que spans criados durante boot
	// (migrations, ping) sejam capturados quando habilitado.
	tracingShutdown, err := tracing.Setup(ctx, tracing.Config{
		ServiceName:    cfg.Observability.OTelServiceName,
		ServiceVersion: servicVersion,
		Environment:    cfg.App.Env,
		OTLPEndpoint:   cfg.Observability.OTLPEndpoint,
	})
	if err != nil {
		return nil, fmt.Errorf("bootstrap: tracing: %w", err)
	}

	m := metrics.New()

	pool, err := pgxlib.New(ctx, cfg.Database, log)
	if err != nil {
		_ = tracingShutdown(ctx)
		return nil, fmt.Errorf("bootstrap: postgres: %w", err)
	}

	if err := pgxmigrate.Run(ctx, cfg.Database.DSN(), migrationsDir(), log); err != nil {
		pool.Close()
		return nil, fmt.Errorf("bootstrap: migrate: %w", err)
	}

	var kc *kafka.Client
	if cfg.Transport.Mode == "kafka" {
		kc, err = kafka.New(kafka.Config{
			Brokers:       cfg.Kafka.Brokers,
			ClientID:      cfg.Kafka.ClientID,
			ConsumerGroup: cfg.Kafka.ConsumerGroup,
			Topics:        cfg.Kafka.Topics.InboundTopics(),
		}, log)
		if err != nil {
			pool.Close()
			return nil, fmt.Errorf("bootstrap: kafka: %w", err)
		}
	}

	// Camada de confiabilidade (G2): TxManager + outbox + sink + recorder.
	txm := tx.NewManager(pool, log)
	var sink outbox.Sink
	if cfg.Transport.Mode == "http" {
		sink = webhooksink.New(
			cfg.Webhook.URL,
			cfg.Webhook.AuthToken,
			cfg.Webhook.Secret,
			cfg.Webhook.Timeout,
		)
	} else {
		sink = kafkasink.New(kc)
	}
	outboxPublisher := outbox.NewPublisher(pool, cfg.Kafka.Topics)
	recorder := outbox.NewRecorder(pool)
	relay := outbox.NewRelay(pool, sink, log, m, cfg.Outbox.BatchSize, cfg.Outbox.PollInterval)

	instanceRepo := postgresrepo.NewInstanceRepository(pool)
	messageRepo := postgresrepo.NewMessageRepository(pool)

	// G3: container whatsmeow + driver real + dispatcher.
	waCont, err := whatsmeowdriver.NewContainer(ctx, cfg.Database.DSN(), log)
	if err != nil {
		pool.Close()
		_ = kc.Close()
		return nil, fmt.Errorf("bootstrap: whatsmeow container: %w", err)
	}
	driver := whatsmeowdriver.New(waCont, instanceRepo, outboxPublisher, log)
	ingest := usecase.NewIngestIncomingMessage(txm, messageRepo, outboxPublisher)
	dispatcher := whatsmeowdriver.NewDispatcher(instanceRepo, outboxPublisher, ingest, driver, log, m)
	driver.SetDispatcher(dispatcher)

	createInstance := usecase.NewCreateInstance(txm, instanceRepo, driver, outboxPublisher)
	sendTextMessage := usecase.NewSendTextMessage(txm, instanceRepo, driver, outboxPublisher)
	deleteInstance := usecase.NewDeleteInstance(txm, instanceRepo, driver)
	reconnectInstance := usecase.NewReconnectInstance(instanceRepo, driver)

	if cfg.Transport.Mode == "kafka" {
		router := inboundkafka.New(log, cfg.Kafka.Topics, createInstance, sendTextMessage, m)
		router.Register(kc, recorder, txm, m)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health/live", inboundhttp.Live())
	mux.HandleFunc("/health/ready", inboundhttp.Ready(pool, log))
	commands := inboundhttp.NewCommands(log, cfg.HTTP.APIKey, createInstance, sendTextMessage, deleteInstance, reconnectInstance)
	mux.HandleFunc("/v1/instances", method(http.MethodPost, commands.CreateInstance()))
	mux.HandleFunc("/v1/instances/reconnect", method(http.MethodPost, commands.ReconnectInstance()))
	mux.HandleFunc("/v1/messages/text", method(http.MethodPost, commands.SendText()))
	mux.HandleFunc("/v1/instances/", method(http.MethodDelete, commands.DeleteInstance()))

	httpSv := &http.Server{
		Addr:              ":" + cfg.HTTP.Port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	metricsMux := http.NewServeMux()
	metricsMux.Handle("/metrics", promhttp.HandlerFor(m.Registry(), promhttp.HandlerOpts{Registry: m.Registry()}))
	metricsSv := &http.Server{
		Addr:              ":" + cfg.Observability.MetricsPort,
		Handler:           metricsMux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return &App{
		cfg: cfg, log: log, pool: pool, kafka: kc, relay: relay,
		httpSv: httpSv, metricsSv: metricsSv,
		driver: driver, waCont: waCont, tracingDown: tracingShutdown,
	}, nil
}

// Run bloqueia ate ctx ser cancelado, executando consumer Kafka, relay
// do outbox e HTTP de health-check em paralelo. Encerra graciosamente
// respeitando cfg.App.ShutdownTimeout.
func (a *App) Run(ctx context.Context) error {
	// G3: recupera sessoes whatsmeow ja pareadas antes de aceitar
	// trafego. Falhas individuais sao logadas em RecoverSessions e
	// nao abortam o boot.
	if err := a.driver.RecoverSessions(ctx); err != nil {
		a.log.Error(ctx, "RecoverSessions falhou", "err", err.Error())
	}

	errCh := make(chan error, 4)

	if a.kafka != nil {
		go func() {
			a.log.Info(ctx, "kafka consumer starting")
			if err := a.kafka.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
				errCh <- fmt.Errorf("kafka consumer: %w", err)
			}
		}()
	}

	go func() {
		if err := a.relay.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
			errCh <- fmt.Errorf("outbox relay: %w", err)
		}
	}()

	go func() {
		a.log.Info(ctx, "http server starting", "addr", a.httpSv.Addr)
		if err := a.httpSv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- fmt.Errorf("http: %w", err)
		}
	}()

	go func() {
		a.log.Info(ctx, "metrics server starting", "addr", a.metricsSv.Addr)
		if err := a.metricsSv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- fmt.Errorf("metrics: %w", err)
		}
	}()

	select {
	case <-ctx.Done():
		a.log.Info(context.Background(), "shutdown signal received")
	case err := <-errCh:
		a.log.Error(context.Background(), "component failure, shutting down", "err", err.Error())
	}

	return a.shutdown()
}

func (a *App) shutdown() error {
	shutdownCtx, cancel := context.WithTimeout(context.Background(), a.cfg.App.ShutdownTimeout)
	defer cancel()

	var firstErr error
	if err := a.httpSv.Shutdown(shutdownCtx); err != nil {
		a.log.Error(shutdownCtx, "http shutdown error", "err", err.Error())
		firstErr = err
	}
	if a.metricsSv != nil {
		if err := a.metricsSv.Shutdown(shutdownCtx); err != nil {
			a.log.Error(shutdownCtx, "metrics shutdown error", "err", err.Error())
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	if a.kafka != nil {
		if err := a.kafka.Close(); err != nil {
			a.log.Error(shutdownCtx, "kafka close error", "err", err.Error())
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	if a.waCont != nil {
		if err := a.waCont.Close(); err != nil {
			a.log.Error(shutdownCtx, "whatsmeow container close error", "err", err.Error())
		}
	}
	a.pool.Close()
	if a.tracingDown != nil {
		if err := a.tracingDown(shutdownCtx); err != nil {
			a.log.Error(shutdownCtx, "tracing shutdown error", "err", err.Error())
		}
	}
	a.log.Info(shutdownCtx, "shutdown complete")
	return firstErr
}

func method(verb string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != verb {
			w.Header().Set("Allow", verb)
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		next(w, r)
	}
}

// migrationsDir resolve o diretorio de migrations.
//
// Ordem de resolucao:
//  1. env MIGRATIONS_DIR (path absoluto) - usado em containers;
//  2. <cwd>/migrations - usado em dev local e testes.
func migrationsDir() string {
	if v := os.Getenv(migrationsDirEnv); v != "" {
		return v
	}
	cwd, err := os.Getwd()
	if err != nil {
		return defaultMigrations
	}
	return filepath.Join(cwd, defaultMigrations)
}
