
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

# Run authorization benchmark
authz-benchmark:
	cd k6-tests/authz-benchmark && k6 run benchmark.js
