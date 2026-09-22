# Oracle A1 deployment

This profile runs Modulo and a private Noesis API on one ARM64 Oracle A1 VM.
Only Caddy publishes Internet-facing ports. Noesis is bound to
`127.0.0.1:8012` and is intended to be reached through an SSH tunnel.

## First deployment

From `/srv/modulo/deploy/oci`:

```sh
./init-env.sh https://modulo.example.com
./render-realm.sh
docker compose -f compose.yml config --quiet
docker compose -f compose.yml up -d --build
./status.sh
```

For pre-DNS validation, use `http://SERVER_IP` as the URL. Do not enter
credentials over this temporary plaintext endpoint. If the realm was already
imported, changing the URL later also requires updating the existing realm and
client in Keycloak; startup imports intentionally do not overwrite them.

Reach Noesis from a trusted workstation:

```sh
ssh -L 8012:127.0.0.1:8012 ubuntu@SERVER_IP
curl http://127.0.0.1:8012/health
```

Run `./backup.sh` for a local snapshot. Local snapshots are not a substitute
for an encrypted off-host backup.

Install the included nightly timer with:

```sh
sudo install -m 0644 systemd/modulo-backup.service /etc/systemd/system/
sudo install -m 0644 systemd/modulo-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now modulo-backup.timer
```
