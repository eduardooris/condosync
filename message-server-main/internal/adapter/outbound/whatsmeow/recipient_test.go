package whatsmeowdriver

import (
	"errors"
	"testing"

	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"go.mau.fi/whatsmeow/types"
)

func TestParseRecipient(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		input      string
		wantUser   string
		wantServer string
		wantErr    bool
		wantCode   string
	}{
		{name: "digitos puros valido", input: "5511999999999", wantUser: "5511999999999", wantServer: types.DefaultUserServer},
		{name: "com prefixo +", input: "+5511999999999", wantUser: "5511999999999", wantServer: types.DefaultUserServer},
		{name: "espacos em volta", input: "  5511999999999  ", wantUser: "5511999999999", wantServer: types.DefaultUserServer},
		{name: "jid s.whatsapp.net aceita", input: "5511999999999@s.whatsapp.net", wantUser: "5511999999999", wantServer: types.DefaultUserServer},
		{name: "jid lid aceita", input: "139534897537145@lid", wantUser: "139534897537145", wantServer: types.HiddenUserServer},
		{name: "vazio rejeitado", input: "", wantErr: true, wantCode: "MESSAGE_INVALID_RECIPIENT"},
		{name: "apenas espacos rejeitado", input: "   ", wantErr: true, wantCode: "MESSAGE_INVALID_RECIPIENT"},
		{name: "grupo rejeitado", input: "120363041234567890@g.us", wantErr: true, wantCode: "MESSAGE_INVALID_RECIPIENT"},
		{name: "broadcast rejeitado", input: "status@broadcast", wantErr: true, wantCode: "MESSAGE_INVALID_RECIPIENT"},
		{name: "letras rejeitadas", input: "abc123", wantErr: true, wantCode: "MESSAGE_INVALID_RECIPIENT"},
		{name: "numero com hifen rejeitado", input: "55-11-99999", wantErr: true, wantCode: "MESSAGE_INVALID_RECIPIENT"},
		{name: "muito curto rejeitado", input: "1234567", wantErr: true, wantCode: "MESSAGE_INVALID_RECIPIENT"},
		{name: "muito longo rejeitado", input: "1234567890123456", wantErr: true, wantCode: "MESSAGE_INVALID_RECIPIENT"},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			jid, err := parseRecipient(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("esperava erro, jid=%v", jid)
				}
				var de *errs.Error
				if !errors.As(err, &de) {
					t.Fatalf("esperava *errs.Error, obteve %T (%v)", err, err)
				}
				if de.Code != tc.wantCode {
					t.Fatalf("code: want=%q got=%q", tc.wantCode, de.Code)
				}
				if de.Kind != errs.KindValidation {
					t.Fatalf("kind: want=Validation got=%s", de.Kind)
				}
				return
			}
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if jid.User != tc.wantUser {
				t.Fatalf("user: want=%q got=%q", tc.wantUser, jid.User)
			}
			if jid.Server != tc.wantServer {
				t.Fatalf("server: want=%q got=%q", tc.wantServer, jid.Server)
			}
		})
	}
}
