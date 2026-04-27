SHELL := /bin/bash

APP_NAME := message-server
PKG := ./...
BIN_DIR := bin
MIGRATIONS_DIR := migrations

# DB_URL e construido a partir das variaveis de ambiente do .env
# (ou exportadas previamente). Pode ser sobrescrito: `make migrate-up DB_URL=...`.
DB_HOST     ?= localhost
DB_PORT     ?= 5432
DB_NAME     ?= wpp_message_server
DB_USER     ?= postgres
DB_PASSWORD ?= postgres
DB_SSLMODE  ?= disable
DB_URL      ?= postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=$(DB_SSLMODE)

.PHONY: help tidy build run test test-integration lint vet fmt cover docker-build clean \
        migrate-up migrate-down migrate-create migrate-version migrate-force

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

tidy: ## Sync go.mod / go.sum
	go mod tidy

fmt: ## Format code
	gofmt -s -w .

vet: ## Run go vet
	go vet $(PKG)

lint: ## Run static analysis (requires golangci-lint)
	golangci-lint run

test: ## Run unit tests
	go test -race -count=1 $(PKG)

test-integration: ## Run integration tests (requires Docker)
	go test -tags=integration -race -count=1 -timeout 5m ./internal/test/integration/...

cover: ## Run tests with coverage
	go test -race -count=1 -coverprofile=coverage.out $(PKG)
	go tool cover -func=coverage.out | tail -n 1

build: ## Build static binary
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(BIN_DIR)/$(APP_NAME) ./cmd/server

run: ## Run locally
	go run ./cmd/server

docker-build: ## Build docker image
	docker build -t $(APP_NAME):latest .

migrate-up: ## Apply all pending migrations
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" up

migrate-down: ## Rollback the last migration
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" down 1

migrate-create: ## Create a new migration: make migrate-create NAME=add_foo
	@if [ -z "$(NAME)" ]; then echo "NAME is required: make migrate-create NAME=add_foo"; exit 1; fi
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $(NAME)

migrate-version: ## Show current migration version
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" version

migrate-force: ## Force a specific version (use with care): make migrate-force V=1
	@if [ -z "$(V)" ]; then echo "V is required: make migrate-force V=1"; exit 1; fi
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" force $(V)

clean:
	rm -rf $(BIN_DIR) coverage.out

