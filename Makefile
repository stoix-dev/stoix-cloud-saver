# stoix-cloud-saver: one-command reproducibility.
#
# The whole showcase runs from here. `make run-local` builds and runs the exact
# same container that ships to the cloud, on your machine, reporting cloud
# "local". The preview-* targets plan cloud changes read-only (zero cost); only
# `deploy-oci` ever creates real infra, and only on the Always Free OCI tier.

# Overridable knobs: `make run-local PORT=8099`
PORT ?= 8080
IMAGE ?= stoix-cloud-saver:local
CONTAINER ?= stoix-cloud-saver-local
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)

.DEFAULT_GOAL := help

.PHONY: help run-local test lint preview-aws preview-do preview-oci deploy-oci clean

help:
	@echo "stoix-cloud-saver targets:"
	@echo "  make run-local [PORT=8080]  Build + run the app container locally (cloud = local)"
	@echo "  make test                   Run all workspace test suites (vitest)"
	@echo "  make lint                   Typecheck all workspaces (tsc --noEmit)"
	@echo "  make preview-aws            Read-only pulumi preview of the AWS stack (zero cost)"
	@echo "  make preview-do             Read-only pulumi preview of the DigitalOcean stack (zero cost)"
	@echo "  make preview-oci            Read-only pulumi preview of the OCI stack (zero cost)"
	@echo "  make deploy-oci             pulumi up on OCI ONLY (the sole live, Always Free env)"
	@echo "  make clean                  Stop the local container and remove build artifacts"

run-local:
	@echo "Building the app image from the repo root context (same image as prod)..."
	docker build -f app/Dockerfile -t $(IMAGE) \
		--build-arg APP_VERSION=local \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		.
	@echo "Starting container '$(CONTAINER)' on port $(PORT) (cloud = local)..."
	@docker rm -f $(CONTAINER) >/dev/null 2>&1 || true
	docker run -d --rm --name $(CONTAINER) \
		-e CLOUD_PROVIDER=local \
		-e CLOUD_REGION=local \
		-p $(PORT):8080 \
		$(IMAGE)
	@echo "Running locally. Open: http://localhost:$(PORT)/"
	@echo "Info endpoint:        http://localhost:$(PORT)/api/info"
	@echo "Stop it with:         make clean"

test:
	@echo "Running all workspace test suites..."
	npm test --workspaces --if-present

lint:
	@echo "Typechecking all workspaces (tsc --noEmit)..."
	npm run lint --workspaces --if-present

# The preview-* targets are READ-ONLY: pulumi preview computes a plan and
# creates/changes/deletes nothing, so they cost nothing. Cloud credentials must
# already be in your environment (PULUMI_ACCESS_TOKEN plus the per-cloud creds:
# AWS_*, DIGITALOCEAN_TOKEN, or OCI_*). Nothing is committed to the repo.
preview-aws:
	@echo "Read-only preview of the AWS stack (zero cost; creds must be in env)..."
	cd infra/aws && pulumi preview

preview-do:
	@echo "Read-only preview of the DigitalOcean stack (zero cost; creds must be in env)..."
	cd infra/digitalocean && pulumi preview

preview-oci:
	@echo "Read-only preview of the OCI stack (zero cost; creds must be in env)..."
	cd infra/oci && pulumi preview

# The only target that creates real infrastructure. Run it ONLY after confirming
# the A1 node pool stays within OCI Always Free sizing (see infra/oci config).
# OCI is the sole live environment; AWS and DigitalOcean stay preview-only.
deploy-oci:
	@echo "Deploying the OCI stack (Always Free). Confirm sizing before proceeding..."
	cd infra/oci && pulumi up

clean:
	@echo "Stopping the local container and removing build artifacts..."
	@docker rm -f $(CONTAINER) >/dev/null 2>&1 || true
	@rm -rf app/dist
	@echo "Clean done."
