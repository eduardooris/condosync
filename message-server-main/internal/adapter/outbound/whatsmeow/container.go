// Package whatsmeowdriver implementa instance.Driver usando a biblioteca
// go.mau.fi/whatsmeow.
package whatsmeowdriver

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib" // registra driver "pgx" em database/sql

	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"go.mau.fi/whatsmeow/store/sqlstore"
)

// NewContainer abre o sqlstore do whatsmeow apontando para o mesmo
// cluster Postgres do app, no schema dedicado `whatsmeow`. As tabelas
// internas da lib sao criadas/upgradedas via container.Upgrade.
//
// O search_path do DSN deve incluir o schema `whatsmeow` (ver bootstrap).
// Em multi-replica seguro: o whatsmeow usa transacoes proprias para os
// upgrades.
func NewContainer(ctx context.Context, dsn string, log logger.Logger) (*sqlstore.Container, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow.container: open: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("whatsmeow.container: ping: %w", err)
	}

	container := sqlstore.NewWithDB(db, "pgx", NewWaLogger(log).Sub("Database"))
	if err := container.Upgrade(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("whatsmeow.container: upgrade: %w", err)
	}
	return container, nil
}
