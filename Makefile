
keycloak-up:
	helm upgrade --install modulo-keycloak infra/keycloak/chart -f infra/keycloak/chart/values.dev.yaml

keycloak-down:
	helm uninstall modulo-keycloak
