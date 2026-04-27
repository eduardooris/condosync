package inboundhttp

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/IAtend-LOC/message-server/internal/application/usecase"
	"github.com/IAtend-LOC/message-server/internal/platform/logger"
	"github.com/IAtend-LOC/message-server/internal/shared/errs"
)

type createInstanceRequest struct {
	CompanyID string `json:"company_id"`
	Name      string `json:"name"`
}

type sendTextRequest struct {
	InstanceID string `json:"instance_id"`
	To         string `json:"to"`
	Body       string `json:"body"`
}

type reconnectInstanceRequest struct {
	InstanceID string `json:"instance_id"`
	CompanyID  string `json:"company_id"`
}

// Commands agrupa handlers HTTP para comandos sincronos do backend.
type Commands struct {
	log               logger.Logger
	apiKey            string
	createInstance    *usecase.CreateInstance
	sendText          *usecase.SendTextMessage
	deleteInstance    *usecase.DeleteInstance
	reconnectInstance *usecase.ReconnectInstance
}

func NewCommands(
	log logger.Logger,
	apiKey string,
	createInstance *usecase.CreateInstance,
	sendText *usecase.SendTextMessage,
	deleteInstance *usecase.DeleteInstance,
	reconnectInstance *usecase.ReconnectInstance,
) *Commands {
	return &Commands{
		log:               log,
		apiKey:            strings.TrimSpace(apiKey),
		createInstance:    createInstance,
		sendText:          sendText,
		deleteInstance:    deleteInstance,
		reconnectInstance: reconnectInstance,
	}
}

func (h *Commands) CreateInstance() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.authorized(r) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		var req createInstanceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
			return
		}
		out, err := h.createInstance.Execute(r.Context(), usecase.CreateInstanceCommand{
			CompanyID: req.CompanyID,
			Name:      req.Name,
		})
		if err != nil {
			h.writeError(r, w, err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"instance_id": out.InstanceID})
	}
}

func (h *Commands) SendText() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.authorized(r) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		var req sendTextRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
			return
		}
		out, err := h.sendText.Execute(r.Context(), usecase.SendTextMessageCommand{
			InstanceID: req.InstanceID,
			To:         req.To,
			Body:       req.Body,
		})
		if err != nil {
			h.writeError(r, w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"wpp_message_id": out.WppMessageID})
	}
}

func (h *Commands) ReconnectInstance() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.authorized(r) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		var req reconnectInstanceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
			return
		}
		out, err := h.reconnectInstance.Execute(r.Context(), usecase.ReconnectInstanceCommand{
			InstanceID: strings.TrimSpace(req.InstanceID),
			CompanyID:  strings.TrimSpace(req.CompanyID),
		})
		if err != nil {
			h.writeError(r, w, err)
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]string{
			"instance_id": out.InstanceID,
			"status":      "reconnect_requested",
		})
	}
}

func (h *Commands) DeleteInstance() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.authorized(r) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		instanceID := strings.TrimPrefix(r.URL.Path, "/v1/instances/")
		instanceID = strings.TrimSpace(instanceID)
		if instanceID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "instance_id_required"})
			return
		}
		if err := h.deleteInstance.Execute(r.Context(), usecase.DeleteInstanceCommand{
			InstanceID: instanceID,
		}); err != nil {
			h.writeError(r, w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Commands) authorized(r *http.Request) bool {
	if h.apiKey == "" {
		return true
	}
	v := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(v), "bearer ") {
		return strings.TrimSpace(v[7:]) == h.apiKey
	}
	return strings.TrimSpace(r.Header.Get("X-API-Key")) == h.apiKey
}

func (h *Commands) writeError(r *http.Request, w http.ResponseWriter, err error) {
	var domainErr *errs.Error
	if errors.As(err, &domainErr) {
		code := http.StatusInternalServerError
		switch domainErr.Kind {
		case errs.KindValidation:
			code = http.StatusBadRequest
		case errs.KindNotFound:
			code = http.StatusNotFound
		case errs.KindConflict:
			code = http.StatusConflict
		case errs.KindForbidden:
			code = http.StatusForbidden
		case errs.KindUnauthorized:
			code = http.StatusUnauthorized
		case errs.KindUnavailable:
			code = http.StatusServiceUnavailable
		}
		writeJSON(w, code, map[string]string{
			"error":   domainErr.Code,
			"message": domainErr.Message,
		})
		return
	}
	h.log.Error(r.Context(), "http command error", "err", err.Error())
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
