// Package postgres encapsula o pool de conexoes pgx usado por toda a
// camada de adapters de saida que falam Postgres (repositorios da
// aplicacao + sqlstore do whatsmeow em G3).
//
// Regras inegociaveis (GUIA_TECNICO secoes 11 e 12):
//   - este pacote e o UNICO autorizado a chamar pgxpool.New;
//   - bootstrap e o unico chamador deste pacote;
//   - falha de ping no boot aborta o processo (fail-fast).
package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/IAtend-LOC/message-server/internal/config"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultMinConns          = 1
	defaultMaxConnLifetime   = 30 * time.Minute
	defaultMaxConnIdleTime   = 5 * time.Minute
	defaultHealthCheckPeriod = 1 * time.Minute
	bootPingTimeout          = 5 * time.Second
)

// New abre o pool pgx e valida conectividade via ping (timeout 5s).
//
// Retorna erro se o DSN for invalido ou o ping falhar; o caller (bootstrap)
// deve abortar o boot nesse caso.
func New(ctx context.Context, cfg config.Database, log logger.Logger) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("postgres: parse dsn: %w", err)
	}

	poolCfg.MaxConns = cfg.MaxConns
	poolCfg.MinConns = defaultMinConns
	poolCfg.MaxConnLifetime = defaultMaxConnLifetime
	poolCfg.MaxConnIdleTime = defaultMaxConnIdleTime
	poolCfg.HealthCheckPeriod = defaultHealthCheckPeriod

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("postgres: new pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, bootPingTimeout)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres: ping host=%s db=%s: %w", cfg.Host, cfg.Name, err)
	}

	log.Info(ctx, "postgres connected",
		"host", cfg.Host,
		"db", cfg.Name,
		"max_conns", cfg.MaxConns,
	)
	return pool, nil
}
