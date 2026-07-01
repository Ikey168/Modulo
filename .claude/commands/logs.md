View logs for a Modulo Docker service.

Parse $ARGUMENTS for: [service] [--dev|--full] [--lines=N]

**Dev stack services** (docker-compose.dev.yml):
- frontend
- backend
- db

**Full stack services** (docker-compose.yml — adds):
- keycloak
- neo4j
- audit-collector
- otel-collector
- jaeger
- prometheus
- grafana
- loki
- elasticsearch
- opa

Defaults: dev stack, 150 lines, follow mode off.

If service is provided in $ARGUMENTS:
```
docker-compose -f /home/Ikey/Modulo/docker-compose[.dev].yml logs --tail=<N> <service>
```

If no service is specified, list the available services and ask which one to tail.

If $ARGUMENTS contains "follow" or "-f", add `--follow` flag (note: this will stream — use Ctrl+C to stop).

If $ARGUMENTS contains "all", show logs for all services without filtering to one.
