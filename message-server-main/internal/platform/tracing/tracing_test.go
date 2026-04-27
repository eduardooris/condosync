package tracing

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

func TestSetup_SemEndpointInstalaPropagator(t *testing.T) {
	t.Parallel()
	shutdown, err := Setup(context.Background(), Config{ServiceName: "x"})
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = shutdown(context.Background()) }()

	prop := otel.GetTextMapPropagator()
	if _, ok := prop.(propagation.TraceContext); !ok {
		t.Fatalf("propagator esperado TraceContext, obtido %T", prop)
	}
}

func TestSetup_ShutdownNoopNaoFalha(t *testing.T) {
	t.Parallel()
	shutdown, err := Setup(context.Background(), Config{ServiceName: "y"})
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
}
