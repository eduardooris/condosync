// Package tracing inicializa o OpenTelemetry SDK do servico.
//
// Decisao: em ambientes sem collector o exporter OTLP travaria o boot.
// Por isso o Setup falha aberto: erros de criacao do exporter sao
// retornados, mas o caller (bootstrap) decide se aborta ou apenas loga
// e prossegue com TracerProvider noop. O propagator W3C TraceContext
// e instalado SEMPRE (mesmo no modo noop) para preservar a propagacao
// entre componentes.
package tracing

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

// Config para o setup do tracer.
type Config struct {
	ServiceName    string
	ServiceVersion string
	Environment    string
	OTLPEndpoint   string // ex: localhost:4317; vazio = exporter desabilitado.
}

// Shutdown e a funcao retornada por Setup que drena spans pendentes.
type Shutdown func(ctx context.Context) error

// Setup configura o TracerProvider global.
//
// Quando OTLPEndpoint e vazio, instala apenas o propagator e retorna
// um shutdown noop -- util em testes e em ambientes sem collector.
func Setup(ctx context.Context, cfg Config) (Shutdown, error) {
	otel.SetTextMapPropagator(propagation.TraceContext{})

	if cfg.OTLPEndpoint == "" {
		return func(context.Context) error { return nil }, nil
	}

	exp, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(cfg.OTLPEndpoint),
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithTimeout(5*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("tracing: otlp exporter: %w", err)
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.ServiceVersion),
			semconv.DeploymentEnvironment(cfg.Environment),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("tracing: resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp,
			sdktrace.WithBatchTimeout(5*time.Second),
		),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)

	return tp.Shutdown, nil
}
