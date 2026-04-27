// Package config carrega a configuracao da aplicacao a partir de variaveis
// de ambiente. E o unico ponto autorizado a ler env vars; todo o restante
// do codigo recebe a Config ja resolvida via injecao de dependencia.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config agrega toda a configuracao da aplicacao.
type Config struct {
	App           App
	HTTP          HTTP
	Database      Database
	Kafka         Kafka
	Transport     Transport
	Webhook       Webhook
	Outbox        Outbox
	Logger        Logger
	Whatsmeow     Whatsmeow
	Observability Observability
}

type App struct {
	Env             string
	Name            string
	ShutdownTimeout time.Duration
}

type HTTP struct {
	Port   string
	APIKey string
}

type Database struct {
	Host     string
	Port     int
	Name     string
	User     string
	Password string
	SSLMode  string
	MaxConns int32
}

// DSN devolve a string de conexao no formato esperado pelo pgx.
func (d Database) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode,
	)
}

type Logger struct {
	Level string
}

type Transport struct {
	Mode string
}

type Webhook struct {
	URL       string
	AuthToken string
	Secret    string
	Timeout   time.Duration
}

// Outbox controla o relay assincrono que drena message_server.outbox
// para Kafka. Os defaults sao seguros para producao (poll curto + lote
// pequeno). Aumentar BatchSize em cenarios de alta cardinalidade.
type Outbox struct {
	BatchSize    int
	PollInterval time.Duration
}

// Whatsmeow concentra parametros do driver e do sqlstore.
type Whatsmeow struct {
	LogLevel string
	DBSchema string
}

// Observability concentra config de Prometheus + OTel exporter.
// MetricsPort e separado de HTTP.Port para isolar scrape de healthcheck.
// Quando OTLPEndpoint e vazio o tracer roda em modo noop.
type Observability struct {
	MetricsPort     string
	OTLPEndpoint    string
	OTelServiceName string
}

// Kafka concentra brokers + nomes de topicos. Topicos NUNCA sao hardcoded
// fora deste struct; sempre passados explicitamente para os adapters.
type Kafka struct {
	Brokers       []string
	ClientID      string
	ConsumerGroup string
	Topics        KafkaTopics
}

type KafkaTopics struct {
	// Inbound (commands consumidos do gateway)
	CmdInstanceCreate  string
	CmdInstanceDelete  string
	CmdMessageSendText string

	// Outbound (events publicados para o gateway)
	EvtInstanceCreated    string
	EvtInstanceQRCode     string
	EvtInstanceConnection string
	EvtMessageReceived    string
	EvtMessageSent        string
}

// InboundTopics devolve a lista de topicos consumidos.
func (t KafkaTopics) InboundTopics() []string {
	return []string{
		t.CmdInstanceCreate,
		t.CmdInstanceDelete,
		t.CmdMessageSendText,
	}
}

// Load le o arquivo .env (apenas em ambiente local) e popula a Config.
// Falhas de parsing fazem o processo abortar imediatamente: nao ha
// "valores defaults silenciosos" em producao.
func Load() (*Config, error) {
	env := getStr("APP_ENV", "local")
	if env == "local" {
		_ = godotenv.Load()
	}

	maxConns, err := strconv.Atoi(getStr("DB_MAX_CONNS", "10"))
	if err != nil {
		return nil, fmt.Errorf("config: DB_MAX_CONNS invalido: %w", err)
	}

	dbPort, err := strconv.Atoi(getStr("DB_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("config: DB_PORT invalido: %w", err)
	}

	shutdown, err := time.ParseDuration(getStr("SHUTDOWN_TIMEOUT", "15s"))
	if err != nil {
		return nil, fmt.Errorf("config: SHUTDOWN_TIMEOUT invalido: %w", err)
	}

	outboxBatch, err := strconv.Atoi(getStr("OUTBOX_BATCH_SIZE", "100"))
	if err != nil {
		return nil, fmt.Errorf("config: OUTBOX_BATCH_SIZE invalido: %w", err)
	}
	outboxPoll, err := time.ParseDuration(getStr("OUTBOX_POLL_INTERVAL", "500ms"))
	if err != nil {
		return nil, fmt.Errorf("config: OUTBOX_POLL_INTERVAL invalido: %w", err)
	}
	webhookTimeout, err := time.ParseDuration(getStr("WEBHOOK_TIMEOUT", "10s"))
	if err != nil {
		return nil, fmt.Errorf("config: WEBHOOK_TIMEOUT invalido: %w", err)
	}

	cfg := &Config{
		App: App{
			Env:             env,
			Name:            getStr("APP_NAME", "message-server"),
			ShutdownTimeout: shutdown,
		},
		HTTP: HTTP{
			Port:   getStr("HTTP_PORT", "8080"),
			APIKey: getStr("HTTP_API_KEY", ""),
		},
		Logger: Logger{
			Level: getStr("LOG_LEVEL", "info"),
		},
		Transport: Transport{
			Mode: getStr("TRANSPORT_MODE", "kafka"),
		},
		Webhook: Webhook{
			URL:       getStr("WEBHOOK_URL", ""),
			AuthToken: getStr("WEBHOOK_AUTH_TOKEN", ""),
			Secret:    getStr("WEBHOOK_SECRET", ""),
			Timeout:   webhookTimeout,
		},
		Outbox: Outbox{
			BatchSize:    outboxBatch,
			PollInterval: outboxPoll,
		},
		Whatsmeow: Whatsmeow{
			LogLevel: getStr("WHATSMEOW_LOG_LEVEL", "INFO"),
			DBSchema: getStr("WHATSMEOW_DB_SCHEMA", "whatsmeow"),
		},
		Observability: Observability{
			MetricsPort:     getStr("METRICS_PORT", "9090"),
			OTLPEndpoint:    getStr("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
			OTelServiceName: getStr("OTEL_SERVICE_NAME", "message-server"),
		},
		Database: Database{
			Host:     getStr("DB_HOST", "localhost"),
			Port:     dbPort,
			Name:     getStr("DB_NAME", "wpp_message_server"),
			User:     getStr("DB_USER", "postgres"),
			Password: getStr("DB_PASSWORD", "postgres"),
			SSLMode:  getStr("DB_SSLMODE", "disable"),
			MaxConns: int32(maxConns),
		},
		Kafka: Kafka{
			Brokers:       getCSV("KAFKA_BROKERS", []string{"localhost:9092"}),
			ClientID:      getStr("KAFKA_CLIENT_ID", "message-server"),
			ConsumerGroup: getStr("KAFKA_CONSUMER_GROUP", "message-server"),
			Topics: KafkaTopics{
				CmdInstanceCreate:     getStr("KAFKA_TOPIC_CMD_INSTANCE_CREATE", "wpp.cmd.instance.create.v1"),
				CmdInstanceDelete:     getStr("KAFKA_TOPIC_CMD_INSTANCE_DELETE", "wpp.cmd.instance.delete.v1"),
				CmdMessageSendText:    getStr("KAFKA_TOPIC_CMD_MESSAGE_SEND_TEXT", "wpp.cmd.message.send-text.v1"),
				EvtInstanceCreated:    getStr("KAFKA_TOPIC_EVT_INSTANCE_CREATED", "wpp.evt.instance.created.v1"),
				EvtInstanceQRCode:     getStr("KAFKA_TOPIC_EVT_INSTANCE_QRCODE", "wpp.evt.instance.qrcode.v1"),
				EvtInstanceConnection: getStr("KAFKA_TOPIC_EVT_INSTANCE_CONNECTION", "wpp.evt.instance.connection.v1"),
				EvtMessageReceived:    getStr("KAFKA_TOPIC_EVT_MESSAGE_RECEIVED", "wpp.evt.message.received.v1"),
				EvtMessageSent:        getStr("KAFKA_TOPIC_EVT_MESSAGE_SENT", "wpp.evt.message.sent.v1"),
			},
		},
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	if c.Transport.Mode != "kafka" && c.Transport.Mode != "http" {
		return fmt.Errorf("config: TRANSPORT_MODE invalido: %s", c.Transport.Mode)
	}
	if c.Transport.Mode == "http" && c.Webhook.URL == "" {
		return fmt.Errorf("config: WEBHOOK_URL obrigatorio quando TRANSPORT_MODE=http")
	}
	if c.Transport.Mode == "kafka" && len(c.Kafka.Brokers) == 0 {
		return fmt.Errorf("config: KAFKA_BROKERS vazio")
	}
	if c.Database.Host == "" {
		return fmt.Errorf("config: DB_HOST vazio")
	}
	return nil
}

func getStr(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func getCSV(key string, def []string) []string {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return def
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return def
	}
	return out
}
