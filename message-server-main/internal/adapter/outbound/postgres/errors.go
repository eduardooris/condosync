// Package postgresrepo implementa os ports de Repository (instance,
// message) usando pgx. Toda traducao de erros pgx -> errs.Kind passa
// por mapError nesta package; nenhum repo deve devolver pgx.* cru
// para a camada de aplicacao.
package postgresrepo

import (
	"errors"
	"fmt"

	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Convencao (G1 - GUIA_TECNICO secao 9 / G1 doc):
//
//   pgx.ErrNoRows                       -> caller decide:
//                                            FindBy*  -> (nil, nil)
//                                            Update*  -> KindNotFound
//   pgerrcode.UniqueViolation           -> KindConflict (default code)
//   pgerrcode.ForeignKeyViolation       -> KindNotFound (default code)
//   pgerrcode.CheckViolation            -> KindValidation
//   default                             -> KindInternal (preserva %w)
//
// Os helpers abaixo aceitam um par (defaultCode, defaultMsg) usado quando
// o erro nao tem codigo de dominio especifico.

// mapError traduz um erro pgx em *errs.Error.
//
// `conflictCode` / `notFoundCode` permitem ao repo identificar o
// agregado violado (ex.: INSTANCE_ALREADY_EXISTS / INSTANCE_NOT_FOUND).
// Se vazios, codigos genericos sao usados.
func mapError(err error, conflictCode, notFoundCode string) error {
	if err == nil {
		return nil
	}

	if errors.Is(err, pgx.ErrNoRows) {
		// Caller (FindBy* x Update*) ja deveria ter tratado.
		// Aqui retornamos KindNotFound como fallback seguro.
		code := notFoundCode
		if code == "" {
			code = "ROW_NOT_FOUND"
		}
		return errs.New(errs.KindNotFound, code, "registro nao encontrado")
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case pgerrcode.UniqueViolation:
			code := conflictCode
			if code == "" {
				code = "UNIQUE_VIOLATION"
			}
			return errs.Wrap(errs.KindConflict, code, "violacao de unicidade", err)
		case pgerrcode.ForeignKeyViolation:
			code := notFoundCode
			if code == "" {
				code = "FOREIGN_KEY_VIOLATION"
			}
			return errs.Wrap(errs.KindNotFound, code, "referencia ausente", err)
		case pgerrcode.CheckViolation, pgerrcode.NotNullViolation:
			return errs.Wrap(errs.KindValidation, "CONSTRAINT_VIOLATION", "constraint violada", err)
		}
	}

	return errs.Wrap(errs.KindInternal, "DB_ERROR", fmt.Sprintf("falha de banco: %v", err), err)
}
