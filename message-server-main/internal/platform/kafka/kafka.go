// Package kafka encapsula o cliente franz-go usado tanto para producao
// quanto para consumo. Toda a aplicacao depende das interfaces Producer
// e Consumer (nao do *kgo.Client) para que possamos trocar de driver
// sem cascata.
package kafka

import (
	"context"
	"fmt"
	"time"

	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/twmb/franz-go/pkg/kgo"
)

// Record e o payload publicado/consumido em Kafka.
type Record struct {
	Topic   string
	Key     []byte
	Value   []byte
	Headers map[string][]byte
}

// Producer publica records de forma sincrona (com confirmacao).
type Producer interface {
	Produce(ctx context.Context, r Record) error
	Close() error
}

// Handler processa um record consumido. Devolver erro abortara o commit
// e a mensagem sera reentregue (at-least-once).
type Handler func(ctx context.Context, r Record) error

// Consumer faz polling do broker e despacha records para o Handler
// registrado no topico correspondente.
type Consumer interface {
	Subscribe(topic string, h Handler)
	Run(ctx context.Context) error
	Close() error
}

// Client agrega Producer + Consumer compartilhando o mesmo *kgo.Client.
type Client struct {
	kc       *kgo.Client
	logger   logger.Logger
	handlers map[string]Handler
}

// Config para construcao do cliente.
type Config struct {
	Brokers       []string
	ClientID      string
	ConsumerGroup string
	Topics        []string
}

// New conecta no broker (com ping) e devolve o Client pronto para uso.
func New(cfg Config, log logger.Logger) (*Client, error) {
	opts := []kgo.Opt{
		kgo.SeedBrokers(cfg.Brokers...),
		kgo.ClientID(cfg.ClientID),
		kgo.AllowAutoTopicCreation(),
		kgo.DisableAutoCommit(),
	}
	if cfg.ConsumerGroup != "" {
		opts = append(opts, kgo.ConsumerGroup(cfg.ConsumerGroup))
	}
	if len(cfg.Topics) > 0 {
		opts = append(opts, kgo.ConsumeTopics(cfg.Topics...))
	}

	kc, err := kgo.NewClient(opts...)
	if err != nil {
		return nil, fmt.Errorf("kafka: new client: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := kc.Ping(pingCtx); err != nil {
		kc.Close()
		return nil, fmt.Errorf("kafka: ping brokers=%v: %w", cfg.Brokers, err)
	}

	log.Info(context.Background(), "kafka connected", "brokers", cfg.Brokers, "client_id", cfg.ClientID)

	return &Client{
		kc:       kc,
		logger:   log,
		handlers: make(map[string]Handler),
	}, nil
}

// Produce implementa Producer.
func (c *Client) Produce(ctx context.Context, r Record) error {
	rec := &kgo.Record{Topic: r.Topic, Key: r.Key, Value: r.Value}
	for k, v := range r.Headers {
		rec.Headers = append(rec.Headers, kgo.RecordHeader{Key: k, Value: v})
	}
	if err := c.kc.ProduceSync(ctx, rec).FirstErr(); err != nil {
		return fmt.Errorf("kafka: produce topic=%s: %w", r.Topic, err)
	}
	return nil
}

// Subscribe registra um handler para um topico. Deve ser chamado antes
// de Run().
func (c *Client) Subscribe(topic string, h Handler) {
	c.handlers[topic] = h
}

// Run inicia o loop de consumo. Bloqueia ate ctx ser cancelado ou ate
// o cliente ser fechado.
func (c *Client) Run(ctx context.Context) error {
	for {
		fetches := c.kc.PollFetches(ctx)
		if errs := fetches.Errors(); len(errs) > 0 {
			for _, e := range errs {
				if e.Err == context.Canceled {
					return nil
				}
				c.logger.Error(ctx, "kafka fetch error", "topic", e.Topic, "err", e.Err.Error())
			}
		}
		if fetches.IsClientClosed() {
			return nil
		}

		iter := fetches.RecordIter()
		for !iter.Done() {
			rec := iter.Next()
			h, ok := c.handlers[rec.Topic]
			if !ok {
				c.logger.Warn(ctx, "no handler for topic", "topic", rec.Topic)
				continue
			}
			headers := make(map[string][]byte, len(rec.Headers))
			for _, h := range rec.Headers {
				headers[h.Key] = h.Value
			}
			r := Record{
				Topic:   rec.Topic,
				Key:     rec.Key,
				Value:   rec.Value,
				Headers: headers,
			}
			if err := h(ctx, r); err != nil {
				c.logger.Error(ctx, "handler failed; will retry on rebalance", "topic", rec.Topic, "err", err.Error())
				continue
			}
			if err := c.kc.CommitRecords(ctx, rec); err != nil {
				c.logger.Error(ctx, "commit failed", "topic", rec.Topic, "err", err.Error())
			}
		}
	}
}

// Close encerra o cliente Kafka.
func (c *Client) Close() error {
	c.kc.Close()
	return nil
}
