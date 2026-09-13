.DEFAULT_GOAL := build

.PHONY: install build check test test-browser test-restore lint format watch-css typecheck

install:
	bun install --frozen-lockfile

build:
	bun run build

check:
	bun run check

test:
	bun run test

test-browser: build
	bun run test:browser

test-restore: build
	bun run test:restore

lint:
	bun run lint

format:
	bun run format

watch-css: build
	bun run dev:css

typecheck:
	bun run typecheck
