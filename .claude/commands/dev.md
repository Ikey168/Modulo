Start the Modulo development environment.

1. Run: `docker-compose -f /home/Ikey/Modulo/docker-compose.dev.yml up -d`
2. Poll until services are ready (retry up to 30s each):
   - Backend: `curl -sf http://localhost:8080/actuator/health` → expect `{"status":"UP"}`
   - Frontend: `curl -sf http://localhost:3000` → expect HTTP 200
   - Postgres: `docker exec $(docker ps -qf name=db) pg_isready -U postgres_dev` → expect `accepting connections`
3. Print a port summary:
   - Frontend:       http://localhost:3000
   - Backend API:    http://localhost:8080
   - Backend debug:  localhost:5005
   - Postgres:       localhost:5432
4. If any service fails to become healthy, show its last 50 log lines with:
   `docker-compose -f /home/Ikey/Modulo/docker-compose.dev.yml logs --tail=50 <service>`

If $ARGUMENTS contains "full" or "stack", use docker-compose.yml (full stack) instead of docker-compose.dev.yml.
