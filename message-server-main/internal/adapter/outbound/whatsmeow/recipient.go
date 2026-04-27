package whatsmeowdriver

import (
	"fmt"
	"strings"

	"github.com/IAtend-LOC/message-server/internal/shared/errs"
	"go.mau.fi/whatsmeow/types"
)

// parseRecipient valida e converte uma string em um types.JID.
//
// Aceita duas formas:
//
//  1. Numero E.164-like (so digitos, opcional `+`): produz JID DM no
//     servidor padrao `s.whatsapp.net`. Ex.: "5511999999999".
//
//  2. JID ja formatada com servidor: passa por types.ParseJID. Suporta
//     `@s.whatsapp.net` (PN) e `@lid` (LinkedID, ~15 digitos). E
//     ESSENCIAL para responder a contatos que se identificam via LID --
//     forcar `@s.whatsapp.net` num LID dispara "no LID found for
//     <digits>@s.whatsapp.net" no servidor.
//
// Grupos (`@g.us`), broadcasts e demais servidores continuam rejeitados
// nesta fase.
func parseRecipient(to string) (types.JID, error) {
	to = strings.TrimSpace(to)
	if to == "" {
		return types.JID{}, errs.New(
			errs.KindValidation,
			"MESSAGE_INVALID_RECIPIENT",
			"destinatario vazio",
		)
	}

	// Caminho 1: ja vem como JID -- delegamos para o parser oficial.
	if strings.ContainsRune(to, '@') {
		jid, err := types.ParseJID(to)
		if err != nil {
			return types.JID{}, errs.Wrap(
				errs.KindValidation,
				"MESSAGE_INVALID_RECIPIENT",
				"jid invalida",
				err,
			)
		}
		switch jid.Server {
		case types.DefaultUserServer, types.HiddenUserServer: // s.whatsapp.net | lid
			return jid, nil
		default:
			return types.JID{}, errs.New(
				errs.KindValidation,
				"MESSAGE_INVALID_RECIPIENT",
				"server jid nao suportado: "+jid.Server,
			)
		}
	}

	// Caminho 2: so digitos -- assume PN comum em s.whatsapp.net.
	to = strings.TrimPrefix(to, "+")

	for _, r := range to {
		if r < '0' || r > '9' {
			return types.JID{}, errs.New(
				errs.KindValidation,
				"MESSAGE_INVALID_RECIPIENT",
				"destinatario deve conter apenas digitos (E.164 sem '+')",
			)
		}
	}

	// Sanidade de tamanho. E.164 permite ate 15 digitos, BR tipico
	// 12-13 (5511...). Numeros fora desta faixa sao quase certamente
	// resultado de normalizacao defeituosa upstream (ex.: "no LID found
	// for 139534897537145@s.whatsapp.net" observado em prod). Falhar
	// aqui evita um round-trip sintatico ao WhatsApp e classifica como
	// erro de dominio rejeitavel pelo router (sem retry-loop).
	const minDigits, maxDigits = 8, 15
	if n := len(to); n < minDigits || n > maxDigits {
		return types.JID{}, errs.New(
			errs.KindValidation,
			"MESSAGE_INVALID_RECIPIENT",
			fmt.Sprintf("destinatario com %d digitos fora do range E.164 [%d-%d]", n, minDigits, maxDigits),
		)
	}

	return types.JID{User: to, Server: types.DefaultUserServer}, nil
}
