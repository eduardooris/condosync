package whatsmeowdriver

import (
	"context"
	"fmt"

	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	waLog "go.mau.fi/whatsmeow/util/log"
)

// waLoggerAdapter adapta o nosso logger.Logger para a interface
// waLog.Logger consumida pela lib whatsmeow. Cada subsistema (client,
// container, etc.) recebe um child logger via Sub(name).
type waLoggerAdapter struct {
	inner logger.Logger
	scope string
}

// NewWaLogger devolve um waLog.Logger que escreve no nosso logger
// estruturado, preservando o nome do modulo whatsmeow como atributo.
func NewWaLogger(inner logger.Logger) waLog.Logger {
	return &waLoggerAdapter{inner: inner, scope: "whatsmeow"}
}

func (a *waLoggerAdapter) Errorf(format string, args ...any) {
	a.inner.Error(context.Background(), fmt.Sprintf(format, args...), "scope", a.scope)
}
func (a *waLoggerAdapter) Warnf(format string, args ...any) {
	a.inner.Warn(context.Background(), fmt.Sprintf(format, args...), "scope", a.scope)
}
func (a *waLoggerAdapter) Infof(format string, args ...any) {
	a.inner.Info(context.Background(), fmt.Sprintf(format, args...), "scope", a.scope)
}
func (a *waLoggerAdapter) Debugf(format string, args ...any) {
	a.inner.Debug(context.Background(), fmt.Sprintf(format, args...), "scope", a.scope)
}
func (a *waLoggerAdapter) Sub(module string) waLog.Logger {
	return &waLoggerAdapter{inner: a.inner, scope: a.scope + "." + module}
}
