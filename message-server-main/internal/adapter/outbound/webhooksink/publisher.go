package webhooksink

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/IAtend-LOC/message-server/internal/platform/kafka"
)

type Sink struct {
	url       string
	authToken string
	secret    string
	timeout   time.Duration
	client    *http.Client
}

func New(url, authToken, secret string, timeout time.Duration) *Sink {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &Sink{
		url:       strings.TrimSpace(url),
		authToken: strings.TrimSpace(authToken),
		secret:    strings.TrimSpace(secret),
		timeout:   timeout,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

func (s *Sink) Produce(ctx context.Context, r kafka.Record) error {
	if s.url == "" {
		return fmt.Errorf("webhooksink: url vazia")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url, bytes.NewReader(r.Value))
	if err != nil {
		return fmt.Errorf("webhooksink: new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Event-Topic", r.Topic)
	if eventID, ok := r.Headers["event_id"]; ok && len(eventID) > 0 {
		req.Header.Set("X-Event-Id", string(eventID))
	}
	if s.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.authToken)
	}
	if s.secret != "" {
		req.Header.Set("X-Signature", signBody(s.secret, r.Value))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("webhooksink: do request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return fmt.Errorf("webhooksink: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
}

func signBody(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}
