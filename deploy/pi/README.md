# Modulo on a Raspberry Pi 5 (#386)

The minimal self-hosted deployment: the core stack (backend, frontend,
Postgres, Neo4j, Keycloak) behind a single Caddy reverse proxy, tuned for an
8 GB Pi 5. No observability sidecars, no IPFS node — everything the workspace,
audit, and business plugins need, nothing else. All data stays on hardware you
own.

## Hardware & OS

- **Raspberry Pi 5, 8 GB** (16 GB is extra headroom, not a requirement).
- **Boot from an NVMe or USB SSD, not an SD card.** Postgres and Neo4j write
  constantly; SD cards are slow and wear out. This is the single most
  important reliability decision.
- 64-bit Raspberry Pi OS (Bookworm) or Debian/Ubuntu arm64.

Install Docker:

```sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then re-login
```

## Setup

```sh
git clone https://github.com/Ikey168/Modulo.git
cd Modulo/deploy/pi
cp .env.example .env
nano .env        # fill in EVERY value — generation commands are in the file
```

Pick how you'll reach the Pi (sets `MODULO_URL` + `MODULO_DOMAIN` in `.env`):

| Access | MODULO_URL | MODULO_DOMAIN | Notes |
|---|---|---|---|
| LAN, by IP | `http://192.168.x.x` | `:80` | simplest |
| LAN, mDNS | `http://modulo.local` | `modulo.local:80` | needs avahi (default on Pi OS) |
| Tailscale (recommended) | `http://<pi>.<tailnet>.ts.net` | `<pi>.<tailnet>.ts.net:80` | reachable anywhere, nothing exposed to the internet |
| Public domain | `https://modulo.example.com` | `modulo.example.com` | Caddy fetches Let's Encrypt certs automatically; requires DNS + open 80/443 |

For a smart-contract-audit vault, **Tailscale is the sweet spot**: you get
access from anywhere without exposing a single port to the internet.

Then:

```sh
docker compose -f docker-compose.pi.yml up -d --build
```

The first build compiles the Spring Boot backend and the Vite frontend **on
the Pi** — expect 20–40 minutes and some fan noise. Subsequent starts are
seconds; rebuilds after `git pull` only recompile what changed. (Impatient?
Build on a PC with `docker buildx build --platform linux/arm64` and load the
images over.)

First login: open `MODULO_URL`. The Keycloak realm (`modulo`) is imported on
first start; create your user in the Keycloak admin console at
`MODULO_URL/auth/admin/` with the admin credentials from `.env`.

## What runs where

| Service | Image / build | Memory cap |
|---|---|---|
| caddy | `caddy:2-alpine` | 128 MB |
| frontend | nginx serving the Vite build | 128 MB |
| backend | Spring Boot (Temurin 17) | 1.5 GB |
| keycloak | `quay.io/keycloak/keycloak:24.0` | 768 MB |
| db | `postgres:16-alpine` | 512 MB |
| neo4j | `neo4j:5.15-community` (512 MB heap / 128 MB pagecache) | 1 GB |

Committed total ≈ 4 GB; an 8 GB Pi keeps ~half free for page cache and builds.
Only Caddy publishes ports (80/443) — Postgres, Neo4j, and Keycloak are not
reachable from the network directly; Keycloak is served through Caddy at
`/auth`.

## Backups (do this — GoBD depends on it)

```sh
sudo mkdir -p /mnt/backup/modulo     # ideally an external disk mountpoint
./backup.sh                          # or: ./backup.sh /path/to/target
crontab -e                           # add:
# 15 3 * * * /home/pi/Modulo/deploy/pi/backup.sh >> /var/log/modulo-backup.log 2>&1
```

`backup.sh` takes a live `pg_dump` and a consistent Neo4j snapshot (Neo4j is
stopped for the seconds the tar takes — Community edition has no online dump),
then prunes files older than `KEEP_DAYS` (default 30). Copy the target dir
off-site periodically (e.g. `rsync` to a Storage Box or an encrypted USB disk
you rotate).

**Test a restore once, now, not during an incident:**

```sh
# Postgres
gunzip -c /mnt/backup/modulo/postgres-<stamp>.sql.gz \
  | docker compose -f docker-compose.pi.yml exec -T db psql -U modulo modulodb
# Neo4j: stop neo4j, untar the snapshot into the neo4j_data volume, start neo4j
```

## Updating

```sh
cd ~/Modulo && git pull
cd deploy/pi && docker compose -f docker-compose.pi.yml up -d --build
```

`MODULO_URL` is baked into the frontend at build time — if you change it,
rebuild (`--build`).

## On-chain anchoring (optional)

The Hardhat node from development is not part of this stack. To anchor reports
and vault documents for real, deploy `NoteRegistry.sol` to an L2 (Base or
Arbitrum keep per-anchor costs at cents) and set `MODULO_BLOCKCHAIN_RPC_URL`
in `.env`. Left empty, anchoring is simply unavailable and everything else
works.

## Known limits / follow-ups

- Keycloak runs in `start-dev` mode (matches the repo's main compose file).
  Fine on a LAN/tailnet; before exposing to the public internet, move it to
  production mode with a database and hostname config.
- Blueprint webhooks (`/api/public/blueprints/webhook/...`) are only reachable
  from wherever Caddy is reachable — on a tailnet that means your own devices,
  which is usually what you want for a home server.
