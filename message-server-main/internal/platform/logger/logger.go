// Package logger fornece um wrapper fino sobre log/slog padronizando os
// campos estruturados emitidos pela aplicacao.
//
// Toda a aplicacao deve depender da interface Logger (nunca de slog.Logger
// direto), de forma que possamos trocar a implementacao em testes ou
// substituir por outro backend (ex.: zap) sem cascata de refactor.
package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

// Logger define o contrato observado por toda a aplicacao.
type Logger interface {
	Debug(ctx context.Context, msg string, args ...any)
	Info(ctx context.Context, msg string, args ...any)
	Warn(ctx context.Context, msg string, args ...any)
	Error(ctx context.Context, msg string, args ...any)
	With(args ...any) Logger
}

type slogLogger struct {
	l *slog.Logger
}

// New cria um Logger JSON estruturado escrevendo em stdout.
func New(level string) Logger {
	return NewWithWriter(level, os.Stdout)
}

// NewWithWriter expoe o destino para uso em testes.
func NewWithWriter(level string, w io.Writer) Logger {
	handler := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level:     parseLevel(level),
		AddSource: false,
	})
	return &slogLogger{l: slog.New(handler)}
}

func parseLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func (s *slogLogger) Debug(ctx context.Context, msg string, args ...any) {
	s.l.DebugContext(ctx, msg, args...)
}
func (s *slogLogger) Info(ctx context.Context, msg string, args ...any) {
	s.l.InfoContext(ctx, msg, args...)
}
func (s *slogLogger) Warn(ctx context.Context, msg string, args ...any) {
	s.l.WarnContext(ctx, msg, args...)
}
func (s *slogLogger) Error(ctx context.Context, msg string, args ...any) {
	s.l.ErrorContext(ctx, msg, args...)
}
func (s *slogLogger) With(args ...any) Logger {
	return &slogLogger{l: s.l.With(args...)}
}
