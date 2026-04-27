# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.25

FROM golang:${GO_VERSION}-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath -ldflags="-s -w" \
    -o /out/message-server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/message-server /app/message-server
# Migrations sao aplicadas no boot via golang-migrate; precisam estar
# embarcadas na imagem. MIGRATIONS_DIR aponta o runtime para esse path.
COPY --from=builder /src/migrations /app/migrations
ENV MIGRATIONS_DIR=/app/migrations
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/message-server"]
