
keycloak-up:
	helm upgrade --install modulo-keycloak infra/keycloak/chart -f infra/keycloak/chart/values.dev.yaml

keycloak-down:
	helm uninstall modulo-keycloak

# Envoy + OPA Authorization Setup
envoy-opa-up:
	docker-compose -f docker-compose.envoy-opa.yml up -d

envoy-opa-down:
	docker-compose -f docker-compose.envoy-opa.yml down

envoy-opa-logs:
	docker-compose -f docker-compose.envoy-opa.yml logs -f

# Test OPA policies
opa-test:
	docker run --rm -v $(PWD)/infra/opa:/workspace openpolicyagent/opa:latest test /workspace

# Test Authorization Policies for Notes RBAC/ABAC
policy-test:
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:latest test /workspace

# Build policy bundle
policy-build:
	docker run --rm -v $(PWD)/policy:/workspace -v $(PWD)/dist:/dist openpolicyagent/opa:latest build /workspace -o /dist/policy-bundle.tar.gz

# Format policy files
policy-fmt:
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:latest fmt --write /workspace

# Run authorization benchmark
authz-benchmark:
	cd k6-tests/authz-benchmark && k6 run benchmark.js

# Policy CI Commands
policy-ci:
	@echo "🔍 Running Policy CI validation..."
	@make policy-fmt
	@make policy-lint
	@make policy-test
	@make policy-build

policy-lint:
	@echo "🔍 Linting policy files..."
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:latest fmt --list /workspace | grep -q . && echo "❌ Policy files need formatting" && exit 1 || echo "✅ Policy files are properly formatted"

policy-coverage:
	@echo "📊 Running policy test coverage..."
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:latest test --coverage /workspace

policy-security-scan:
	@echo "🔒 Scanning policies for security issues..."
	@grep -r "password\|secret\|token\|key" policy/ && echo "⚠️  Found potential sensitive data" || echo "✅ No sensitive data found"

policy-validate:
	@echo "🔍 Validating policy syntax..."
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:latest parse /workspace

# Install policy CI dependencies
install-policy-ci:
	@echo "📦 Installing policy CI dependencies..."
	@which opa > /dev/null || (echo "Installing OPA..." && curl -L -o /usr/local/bin/opa https://openpolicyagent.org/downloads/v0.58.0/opa_linux_amd64_static && chmod +x /usr/local/bin/opa)
	@which conftest > /dev/null || (echo "Installing Conftest..." && wget -O- https://github.com/open-policy-agent/conftest/releases/download/v0.46.0/conftest_0.46.0_Linux_x86_64.tar.gz | tar xz -C /usr/local/bin)
