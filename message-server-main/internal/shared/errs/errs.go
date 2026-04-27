// Package errs centraliza os tipos de erro de dominio da aplicacao.
//
// Use sempre erros desta package quando a falha tiver significado de
// negocio (ex.: instancia nao encontrada). Erros de infraestrutura
// (timeout, IO, marshal) devem ser embrulhados com fmt.Errorf("%w", err)
// e classificados nas bordas dos adapters.
package errs

import (
	"errors"
	"fmt"
)

// Kind classifica um erro de dominio. Os adapters HTTP / Kafka traduzem
// Kind em codigo de status / DLQ.
type Kind string

const (
	KindValidation   Kind = "VALIDATION"
	KindNotFound     Kind = "NOT_FOUND"
	KindConflict     Kind = "CONFLICT"
	KindUnauthorized Kind = "UNAUTHORIZED"
	KindForbidden    Kind = "FORBIDDEN"
	KindUnavailable  Kind = "UNAVAILABLE"
	KindInternal     Kind = "INTERNAL"
)

// Error e o tipo concreto de erro de dominio.
type Error struct {
	Kind    Kind
	Code    string
	Message string
	Cause   error
}

func (e *Error) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s [%s]: %s: %v", e.Kind, e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s [%s]: %s", e.Kind, e.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.Cause }

// New cria um erro de dominio sem causa subjacente.
func New(kind Kind, code, message string) *Error {
	return &Error{Kind: kind, Code: code, Message: message}
}

// Wrap embrulha um erro adicionando classificacao de dominio.
func Wrap(kind Kind, code, message string, cause error) *Error {
	return &Error{Kind: kind, Code: code, Message: message, Cause: cause}
}

// AsKind devolve o Kind do erro caso seja *Error; caso contrario KindInternal.
func AsKind(err error) Kind {
	var e *Error
	if errors.As(err, &e) {
		return e.Kind
	}
	return KindInternal
}
