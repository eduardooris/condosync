// Package migrate aplica migrations versionadas em SQL puro usando
// golang-migrate. Em prod o boot do servico chama Run() apos abrir o
// pool; o lock distribuido do golang-migrate (advisory lock no
// Postgres) garante que apenas uma replica aplica as migrations.
package migrate

import (
	"context"
	"errors"
	"fmt"

	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/golang-migrate/migrate/v4"

	// Driver de banco para Postgres usando pgx v5.
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	// Source driver para ler arquivos do filesystem.
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// Run aplica todas as migrations pendentes em `dir` contra o banco
// apontado por `dsn`. E idempotente: noop quando o banco ja esta na
// versao mais recente.
//
// `dir` deve ser um caminho absoluto OU um caminho relativo precedido
// por `file://`. Internamente normalizamos.
func Run(ctx context.Context, dsn, dir string, log logger.Logger) error {
	source := dir
	if len(source) < 7 || source[:7] != "file://" {
		source = "file://" + source
	}

	// pgx5 driver expects the same DSN format as pgx itself.
	m, err := migrate.New(source, "pgx5://"+stripScheme(dsn))
	if err != nil {
		return fmt.Errorf("migrate: open: %w", err)
	}
	defer func() {
		srcErr, dbErr := m.Close()
		if srcErr != nil {
			log.Warn(ctx, "migrate: source close error", "err", srcErr.Error())
		}
		if dbErr != nil {
			log.Warn(ctx, "migrate: db close error", "err", dbErr.Error())
		}
	}()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: up: %w", err)
	}

	version, dirty, verr := m.Version()
	if verr != nil && !errors.Is(verr, migrate.ErrNilVersion) {
		return fmt.Errorf("migrate: version: %w", verr)
	}
	log.Info(ctx, "migrations applied", "version", version, "dirty", dirty)
	return nil
}

// stripScheme remove o prefixo "postgres://" ou "postgresql://" para
// evitar duplicacao quando reusamos o DSN com o driver pgx5 do migrate.
func stripScheme(dsn string) string {
	for _, prefix := range []string{"postgres://", "postgresql://"} {
		if len(dsn) >= len(prefix) && dsn[:len(prefix)] == prefix {
			return dsn[len(prefix):]
		}
	}
	return dsn
}
