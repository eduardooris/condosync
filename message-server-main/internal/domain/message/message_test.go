package message

import (
	"testing"
	"time"

	"github.com/IAtend-LOC/message-server/internal/shared/id"
)

// TestHydrate garante que Hydrate reconstroi o agregado preservando
// todos os campos e SEM aplicar invariantes (e o port de saida do
// Repository, nao do construtor).
func TestHydrate(t *testing.T) {
	t.Parallel()

	mid := id.New()
	instID := id.New()
	ts := time.Date(2026, 4, 23, 13, 0, 0, 0, time.FixedZone("BRT", -3*3600))

	got := Hydrate(
		mid, instID, "wpp-XYZ",
		DirectionInbound, KindText,
		"5511999990000@s.whatsapp.net",
		"5511888880000@s.whatsapp.net",
		"ola",
		ts,
	)

	if got == nil {
		t.Fatal("Hydrate retornou nil")
	}
	if got.ID() != mid {
		t.Errorf("ID: want %s, got %s", mid, got.ID())
	}
	if got.InstanceID() != instID {
		t.Errorf("InstanceID: want %s, got %s", instID, got.InstanceID())
	}
	if got.WppID() != "wpp-XYZ" {
		t.Errorf("WppID mismatch: %s", got.WppID())
	}
	if got.Direction() != DirectionInbound {
		t.Errorf("Direction: %s", got.Direction())
	}
	if got.Kind() != KindText {
		t.Errorf("Kind: %s", got.Kind())
	}
	if got.From() != "5511999990000@s.whatsapp.net" {
		t.Errorf("From: %s", got.From())
	}
	if got.To() != "5511888880000@s.whatsapp.net" {
		t.Errorf("To: %s", got.To())
	}
	if got.Body() != "ola" {
		t.Errorf("Body: %s", got.Body())
	}
	// Hydrate deve normalizar para UTC (consistencia com NewInbound/Outbound).
	if loc := got.Timestamp().Location(); loc != time.UTC {
		t.Errorf("Timestamp location: want UTC, got %s", loc)
	}
	if !got.Timestamp().Equal(ts) {
		t.Errorf("Timestamp: want %s, got %s", ts, got.Timestamp())
	}
}

// TestHydrate_DoesNotValidate confirma que Hydrate NAO aplica as
// invariantes de NewInbound/NewOutbound. E essencial para repos:
// dados ja persistidos podem violar regras adicionadas depois e
// ainda assim devem ser carregaveis.
func TestHydrate_DoesNotValidate(t *testing.T) {
	t.Parallel()

	got := Hydrate(
		"", "", "", DirectionInbound, KindText, "", "", "", time.Time{},
	)
	if got == nil {
		t.Fatal("Hydrate deve devolver instancia mesmo com campos vazios")
	}
	if got.Body() != "" {
		t.Errorf("Body deveria ser vazio, got %q", got.Body())
	}
}

// TestHydrate_ZeroTimestampNormalizedToUTC garante que zero time
// continua zero apos UTC() (sem injecao de now()).
func TestHydrate_ZeroTimestampStaysZero(t *testing.T) {
	t.Parallel()

	got := Hydrate("a", "b", "c", DirectionOutbound, KindText, "f", "t", "body", time.Time{})
	if !got.Timestamp().IsZero() {
		t.Errorf("zero timestamp foi alterado para %s", got.Timestamp())
	}
}
