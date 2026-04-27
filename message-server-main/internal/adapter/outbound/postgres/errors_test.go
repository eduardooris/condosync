package postgresrepo

import (
	"errors"
	"fmt"
	"testing"

	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestMapError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		err          error
		conflictCode string
		notFoundCode string
		wantNil      bool
		wantKind     errs.Kind
		wantCode     string
	}{
		{
			name:    "nil passthrough",
			err:     nil,
			wantNil: true,
		},
		{
			name:         "ErrNoRows fallback to KindNotFound",
			err:          pgx.ErrNoRows,
			notFoundCode: "INSTANCE_NOT_FOUND",
			wantKind:     errs.KindNotFound,
			wantCode:     "INSTANCE_NOT_FOUND",
		},
		{
			name:         "ErrNoRows generic when notFoundCode empty",
			err:          pgx.ErrNoRows,
			notFoundCode: "",
			wantKind:     errs.KindNotFound,
			wantCode:     "ROW_NOT_FOUND",
		},
		{
			name:         "UniqueViolation -> KindConflict",
			err:          &pgconn.PgError{Code: pgerrcode.UniqueViolation},
			conflictCode: "INSTANCE_ALREADY_EXISTS",
			wantKind:     errs.KindConflict,
			wantCode:     "INSTANCE_ALREADY_EXISTS",
		},
		{
			name:         "ForeignKeyViolation -> KindNotFound",
			err:          &pgconn.PgError{Code: pgerrcode.ForeignKeyViolation},
			notFoundCode: "INSTANCE_NOT_FOUND",
			wantKind:     errs.KindNotFound,
			wantCode:     "INSTANCE_NOT_FOUND",
		},
		{
			name:     "CheckViolation -> KindValidation",
			err:      &pgconn.PgError{Code: pgerrcode.CheckViolation},
			wantKind: errs.KindValidation,
			wantCode: "CONSTRAINT_VIOLATION",
		},
		{
			name:     "NotNullViolation -> KindValidation",
			err:      &pgconn.PgError{Code: pgerrcode.NotNullViolation},
			wantKind: errs.KindValidation,
			wantCode: "CONSTRAINT_VIOLATION",
		},
		{
			name:     "generic error -> KindInternal",
			err:      fmt.Errorf("connection refused"),
			wantKind: errs.KindInternal,
			wantCode: "DB_ERROR",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := mapError(tc.err, tc.conflictCode, tc.notFoundCode)
			if tc.wantNil {
				if got != nil {
					t.Fatalf("expected nil, got %v", got)
				}
				return
			}
			var de *errs.Error
			if !errors.As(got, &de) {
				t.Fatalf("expected *errs.Error, got %T (%v)", got, got)
			}
			if de.Kind != tc.wantKind {
				t.Errorf("kind: want %s, got %s", tc.wantKind, de.Kind)
			}
			if de.Code != tc.wantCode {
				t.Errorf("code: want %s, got %s", tc.wantCode, de.Code)
			}
		})
	}
}

func TestMapErrorPreservesCause(t *testing.T) {
	t.Parallel()
	cause := &pgconn.PgError{Code: pgerrcode.UniqueViolation, Message: "duplicate key"}
	got := mapError(cause, "X", "")
	if !errors.Is(got, cause) {
		t.Fatalf("expected wrapped cause to be retained, got %v", got)
	}
}
