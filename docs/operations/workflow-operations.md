# Workflow operations

Issue #429. Execution Center's **Alerts and retention** controls are scoped to
the signed-in Blueprint owner. Failure thresholds support 1–1000 failed or
dead-letter runs in a 1–1440 minute window. Routing can be disabled, sent to the
Execution Center, or inserted into the existing notification inbox. Alerts are
deduplicated per workflow and time bucket; inbox insertion and alert creation
commit together. Reading or deleting the inbox notification clears its unread
metric on the next poll. Alert payloads contain counts and workflow IDs, not
node inputs, secrets or exception text.

History retention is 7–365 days after completion. Replay payload retention is
1 hour through the history-retention limit. Hourly cleanup deletes eligible
terminal checkpoints and removes note references from step summaries while
preserving timing, state and type counts. Active and waiting runs retain their
checkpoints. An immutable parent UUID preserves retry lineage when the parent's
history expires; following that reference displays the normal retention-gap
message. Replays without retained checkpoints are unavailable. Existing history
uses 90 days unless an owner saves a policy.

## Metrics and dashboard

The worker refreshes gauges every 30 seconds. The default management listener is
port 8081 at `/actuator/prometheus`; the monitoring scrape target now matches it.
Profiles that override the management port must update their scrape target.
The scheduling pool has four threads so a long dispatcher action cannot block
metrics and retention jobs.

Import `monitoring/grafana/dashboards-available/workflow-executions.json` with the
provisioned `prometheus` datasource. Its queries use `max`, not sums across
replicas, because every replica observes the same database-wide gauges.

| Prometheus metric | Meaning |
| --- | --- |
| `modulo_workflow_runs{state}` | Retained runs in each of eight fixed states |
| `modulo_workflow_run_rate{state}` | Runs per second in the last five minutes, using completion time for completed runs |
| `modulo_workflow_run_latency_seconds{quantile}` | Completed-run p50/p95/p99 over five minutes, including intentional waits |
| `modulo_workflow_retries` | Retained attempts with a parent reference |
| `modulo_workflow_queue_depth` | Pending or running schedule deliveries |
| `modulo_workflow_schedule_lag_seconds` | Maximum lateness of an enabled, active schedule |
| `modulo_workflow_alerts_unread` | Unread workflow alerts |

There are exactly 23 series per application instance. No owner, Blueprint, run,
step, node or error-message labels are created. Rates are rolling gauges, so do
not apply Prometheus `rate()` to them.

`monitoring/prometheus/rules/workflow-alerts.yml` defines sustained failure,
dead-letter, schedule-lag and backlog alerts. The companion promtool fixture
injects all four unhealthy conditions and verifies their labels and messages:

```sh
docker run --rm -v "$PWD/monitoring/prometheus:/prom:ro" -w /prom/tests \
  --entrypoint /bin/promtool prom/prometheus:v2.54.1 \
  test rules workflow-alerts.test.yml
```

## Repeatable load gate

With Java 17, Maven and Docker available, run:

```sh
scripts/workflow-load-test.sh
```

The Testcontainers fixture uses disposable PostgreSQL 16 and synthetic data. It
inserts 10,000 runs and high-cardinality step IDs, enqueues 100 simultaneously due
schedules twice, and refreshes the complete metric set. The test requires exactly
100 delivery records, 23 series, no unbounded tag keys, accurate counts, and less
than 30 seconds for enqueue plus metric refresh. It runs in the standard backend
suite; the script isolates the same test for repeatable comparisons.

Successful local result on 2026-09-05 (Java 17, PostgreSQL 16):

| Traces | Due schedules | Metric series | Enqueue + refresh | Budget |
| ---: | ---: | ---: | ---: | ---: |
| 10,000 | 100 | 23 | 167 ms | 30,000 ms |

This measures database dispatch bookkeeping and metric aggregation, not external
AI/blockchain latency or maximum production throughput. Separate integration tests
cover injected failures, inbox deduplication, owner isolation, payload expiry,
active-checkpoint preservation and retry references after parent deletion.
