// Command server e o entrypoint da message-server.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/IAtend-LOC/message-server/internal/bootstrap"
	"github.com/IAtend-LOC/message-server/internal/config"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	log := logger.New(cfg.Logger.Level).With(
		"service", cfg.App.Name,
		"env", cfg.App.Env,
	)

	log.Info(context.Background(), "starting", "version", "0.1.0")

	app, err := bootstrap.New(cfg, log)
	if err != nil {
		return fmt.Errorf("bootstrap: %w", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	return app.Run(ctx)
}
