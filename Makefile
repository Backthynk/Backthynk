.PHONY: dev

dev:
	env APP_ENV=development go run ./cmd/server/main.go