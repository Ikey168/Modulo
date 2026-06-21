# Available (manually-imported) Grafana dashboards

Dashboards in this directory are **not** auto-provisioned. They are kept here
so you can import them by hand from the Grafana UI.

## Why these aren't auto-provisioned

`authorization-audit.json` triggers a known regression in Grafana's file-based
dashboard provisioner (observed on Grafana 10.2.3): on every provisioning pass
Grafana logs

```
logger=provisioning.dashboard type=file name="Authorization Audit Dashboards"
level=error msg="failed to save dashboard"
file=/var/lib/grafana/dashboards/authorization-audit.json
error="could not resolve dashboards:uid:authorization-audit: Dashboard not found"
```

This is an upstream provisioner bug, not a problem with the dashboard model —
the same JSON imports cleanly through the UI. See:

- https://github.com/grafana/grafana/issues/73043
- https://github.com/grafana/grafana/issues/87342

Because the provisioner re-scans every `updateIntervalSeconds` (10s), leaving the
file in the provisioned path floods the logs with that error. Moving it here
keeps `docker compose up` clean while preserving the dashboard.

## How to import it

1. Open Grafana: http://localhost:3000 (admin / admin123).
2. Left nav -> **Dashboards** -> **New** -> **Import**.
3. **Upload dashboard JSON file** and choose `authorization-audit.json` from
   this directory (or paste its contents).
4. When prompted, select the **Prometheus**, **Loki**, and **Jaeger**
   datasources (these are already provisioned, so they appear in the dropdowns).
5. Click **Import**.

The dashboard lands in the **Security & Audit** folder and works exactly as it
would have if auto-provisioned.

## Re-enabling auto-provisioning

If a future Grafana version fixes the provisioner bug, move the JSON back to
`../dashboards/` and it will be picked up automatically on the next start.
