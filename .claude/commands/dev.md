Start the Modulo development environment.

The dev compose file holds only backing services; the backend and frontend run natively
(see docs/getting-started/local-development.md).

1. Run: `docker compose -f /home/Ikey/Modulo/docker-compose.dev.yml up -d`
   (add `--profile observability` to also start Jaeger on http://localhost:16686).
2. Poll until the services are ready (retry up to 60s each):
   - Postgres: `docker compose -f /home/Ikey/Modulo/docker-compose.dev.yml exec db pg_isready -U postgres` → expect `accepting connections`
   - Keycloak: `curl -sf http://localhost:8180/realms/modulo` → expect HTTP 200
3. Tell the user how to start the apps natively:
   - Backend: `cd backend && SPRING_PROFILES_ACTIVE=docker SERVER_SERVLET_CONTEXT_PATH=/ SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/modulodb SPRING_DATASOURCE_USERNAME=postgres SPRING_DATASOURCE_PASSWORD=postgres MODULO_SECURITY_KEYCLOAK_JWK_SET_URI=http://localhost:8180/realms/modulo/protocol/openid-connect/certs MODULO_SECURITY_KEYCLOAK_ISSUER_URI=http://localhost:8180/realms/modulo MODULO_GRAPH_ENABLED=false mvn spring-boot:run`
   - Frontend: `npm run dev --workspace=frontend`
4. Print a port summary:
   - Frontend (Vite): http://localhost:3000
   - Backend API:     http://localhost:8080
   - Keycloak:        http://localhost:8180 (admin/admin; app login demo/demo)
   - Postgres:        localhost:5432
5. If a service fails to become ready, show its last 50 log lines with:
   `docker compose -f /home/Ikey/Modulo/docker-compose.dev.yml logs --tail=50 <service>`

If $ARGUMENTS contains "full" or "stack", use docker-compose.yml (full stack, `docker compose up -d --build`) instead of docker-compose.dev.yml.
