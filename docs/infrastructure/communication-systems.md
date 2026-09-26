# Communication systems operations and closeout

Last verified: 2026-09-20

This document records the deployed state and acceptance evidence for the
Communication Systems projects. It intentionally contains no credentials,
recovery secrets, message bodies, or bridge tokens.

## Current architecture

- Raspberry Pi 5 (`pi5`) runs Synapse, PostgreSQL, Element Web, and the
  Discord, WhatsApp, Signal, and Telegram Mautrix bridges in Docker.
- Synapse is available on the LAN through TLS at `matrix.lan`. PostgreSQL and
  Synapse's direct HTTP listener are not exposed beyond the host.
- All four bridges use PostgreSQL, have encryption enabled, and run with a
  persistent restart policy.
- The Pi health timer treats all Matrix services and all four bridges as
  critical. The Telegram readiness endpoint is checked in addition to its
  container state.
- Bridge configuration and appservice registration files are restricted to
  the service owner. The Synapse signing key is mode `600`.

The current local-only deployment supersedes the earlier split design that
placed the public Matrix server and bridge credentials on different hosts. It
removes the public Matrix VPS from the trust boundary, but does not isolate
bridge plaintext from Synapse because both now run on the Pi.

## Verification evidence

The 2026-09-20 acceptance check observed:

- all 12 critical Pi services healthy;
- all four Mautrix containers running on the Pi;
- one active account for WhatsApp, Signal, and Telegram;
- persisted portal and cryptographic state for the deployed bridges;
- Telegram receiving inbound Megolm sessions and no decrypt/key-share errors
  during the final 30-minute observation window; and
- no message content inspected during verification.

This establishes deployment, account pairing, encrypted bridge operation,
supervision, and Pi-local persistence. It does not prove every protocol
feature. Native-client coexistence, all media/reaction variants, Signal portal
creation, and a controlled internet-outage test remain explicit acceptance
gates.

## Backup and recovery

The workstation runs two user timers:

- `matrix-backup-capture.timer` creates a daily backup in the mounted
  Cryptomator recovery vault; and
- `matrix-backup-monitor.timer` checks freshness, checksums, and empty
  components every six hours.

The capture includes the complete PostgreSQL cluster, Synapse configuration,
signing key, appservice registrations, media store, Element configuration,
and each bridge's configuration and registration. The job refuses to write an
unencrypted fallback when the Cryptomator vault is unavailable.

The first protected capture is `20260920T200648Z`. Its checksum and freshness
monitor passed. An isolated restore drill loaded the dump into a temporary
PostgreSQL 16 container with no network and tmpfs-only storage, then verified
non-empty schemas in `synapse` and all four Mautrix databases. The temporary
container was removed after the test.

Operational files:

- `scripts/matrix-backup-capture.sh`
- `scripts/matrix-backup-monitor.sh`
- `scripts/matrix-restore-drill.sh`
- `scripts/matrix-backup-capture.{service,timer}`
- `scripts/matrix-backup-monitor.{service,timer}`
- `scripts/pi-service-health.sh`

## Project disposition

| Project | Disposition | Evidence or remaining gate |
| --- | --- | --- |
| Harden Communication Identity & Recovery | Active | COMM-01 through COMM-07 are complete. Lost-phone/provider recovery and final owner acceptance remain. |
| Establish Communication Identity & Addressing | Planning | Permanent public Matrix identity, canonical addressing, aliases, and authoritative contact data remain. |
| Standardize Native Messaging | Planning | Requires owner-controlled phone settings, linked-device checks, and live native-client validation. |
| Deploy Personal Matrix Infrastructure | Active | The private Pi stack is operational. Public domain delegation, federation, MAS, MatrixRTC/TURN, and cross-device call tests remain. |
| Build Unified Messaging with Mautrix | Active | All four bridges are deployed, paired, encrypted, supervised, and persistent. Protocol feature tests listed above remain. |
| Move Messaging Bridges to Raspberry Pi | Active | Bridge services and databases are Pi-local and supervised. A planned maintenance-window reboot/outage test remains; the same-host architecture is documented above. |
| Design Communication Attention & Organization | Planning | Spaces, room inventory, notification exceptions, and owner preference decisions remain. |
| Integrate Communication with Modulo | Planning | Message-to-record actions, schema, backlinks, and project-context routing are not implemented. |
| Integrate Communication with Noesis & Automation | Planning | Allowlisted ingestion, provenance, output routing, deduplication, and rate limits are not implemented. |
| Make Communication Infrastructure Recoverable | Active | Automated protected backups and a database restore drill pass. Full host rebuild plus phone, YubiKey, Matrix-host, Oracle, and home-internet exercises remain. |

## Safe maintenance procedure

1. Confirm the Cryptomator vault is mounted and the backup monitor reports
   `status: ok`.
2. Capture a fresh backup before a planned infrastructure change.
3. Check `~/.local/state/pi-service-health/last.json` on the Pi for 12 of 12
   healthy services.
4. Perform disruptive reboot or outage tests only in an announced maintenance
   window with native messaging clients available as fallback.
5. After the test, verify all bridge account and portal counts without reading
   message content, then record the result in Modulo.
