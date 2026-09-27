
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
	docker run --rm -v $(PWD)/infra/opa:/workspace openpolicyagent/opa:0.59.0 test --ignore '*.yaml' /workspace

# Test Authorization Policies for Notes RBAC/ABAC
policy-test:
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:0.59.0 test /workspace

# Build policy bundle
policy-build:
	docker run --rm -v $(PWD)/policy:/workspace -v $(PWD)/dist:/dist openpolicyagent/opa:0.59.0 build /workspace -o /dist/policy-bundle.tar.gz

# Format policy files
policy-fmt:
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:0.59.0 fmt --write /workspace

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
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:0.59.0 fmt --list /workspace | grep -q . && echo "❌ Policy files need formatting" && exit 1 || echo "✅ Policy files are properly formatted"

policy-coverage:
	@echo "📊 Running policy test coverage..."
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:0.59.0 test --coverage /workspace

policy-security-scan:
	@echo "🔒 Scanning policies for security issues..."
	@grep -r "password\|secret\|token\|key" policy/ && echo "⚠️  Found potential sensitive data" || echo "✅ No sensitive data found"

policy-validate:
	@echo "🔍 Validating policy syntax..."
	docker run --rm -v $(PWD)/policy:/workspace openpolicyagent/opa:0.59.0 parse /workspace

# Install policy CI dependencies
install-policy-ci:
	@echo "📦 Installing policy CI dependencies..."
	@which opa > /dev/null || (echo "Installing OPA..." && curl -fL -o /usr/local/bin/opa https://github.com/open-policy-agent/opa/releases/download/v0.59.0/opa_linux_amd64_static && chmod +x /usr/local/bin/opa)
