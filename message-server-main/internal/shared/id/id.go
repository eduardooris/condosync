// Package id encapsula geracao e parsing de identificadores.
// Toda entidade de dominio com identidade deve usar id.New() ao inves
// de chamar uuid.NewString diretamente, garantindo um unico ponto de
// troca caso queiramos migrar para ULID/KSUID.
package id

import "github.com/google/uuid"

type ID = string

// New gera um novo identificador (UUID v4).
func New() ID {
	return uuid.NewString()
}

// Parse valida que value e um identificador valido.
func Parse(value string) (ID, error) {
	u, err := uuid.Parse(value)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}
