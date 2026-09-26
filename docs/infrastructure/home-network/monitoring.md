# Monitoring record

The desktop runs small metadata-only systemd user timers. These checks do not
collect client traffic, credentials, DNS query history, or configuration
contents.

| Check | Cadence | State file | Purpose |
| --- | --- | --- | --- |
| Home-network path | 1 minute | `~/.local/state/home-network-monitor/last.json` | Gateway, AP, Pi, DNS and Internet reachability |
| MikroTik health | 5 minutes | `~/.local/state/mikrotik-health-monitor/last.json` | Uptime, CPU, memory, storage, WAN counters/errors, DHCP and WireGuard state |
| MikroTik events | 5 minutes | `~/.local/state/mikrotik-event-monitor/events.jsonl` | Actionable account, configuration, interface, DHCP failure, VPN and severity events |
| AP/Pi health | 5 minutes | `~/.local/state/ap-pi-monitor/last.json` | AP bridge/radios/uplink and Pi services/storage |
| Backup integrity | 1 hour | `~/.local/state/network-backup-monitor/last.json` | Age, mode and checksum of gateway/AP backups |

Router health uses the `modulo-monitor` RouterOS account, restricted to the
desktop address and a group containing only SSH, read and test policies. Its
dedicated private key is outside PARA at
`~/.local/share/modulo/network-monitor/id_ed25519`, mode `600`.

The event collector keeps at most 2,000 deduplicated local records, redacts MAC
addresses, excludes routine DHCP lease churn, and excludes its own SSH session
noise. RouterOS retains the source ring buffer; the desktop copy makes relevant
events available after the ring rotates without enabling high-volume WAN-drop
logging.

Non-OK checks exit unsuccessfully and log a concise diagnostic. An independent
external notification path is still required before total-site outages can be
considered alert-complete.

The 2026-09-21 live baseline and the remaining Uptime Kuma reconciliation and
alert-route gates are recorded in
[monitoring-acceptance-2026-09-21.md](monitoring-acceptance-2026-09-21.md).
