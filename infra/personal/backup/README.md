# Netcup state backup boundary

The files in this directory define an opt-in restic boundary for the
disposable development host. They do not create a provider bucket, contain a
repository password, or upload anything by default.

## Required operator setup

Create `/etc/netcup-backup/restic.env` with mode `0600`, owned by `root`, and
set only non-secret repository settings, for example:

```sh
RESTIC_REPOSITORY=b2:example-bucket:/netcup/dev
RESTIC_PASSWORD_FILE=/etc/netcup-backup/restic-password
```

Store the restic password in the separate `RESTIC_PASSWORD_FILE`, also mode
`0600`. Keep B2 application keys outside this repository and provide them only
through the restic-supported environment at execution time. Never put them in
Modulo, Git, the archive, or a systemd unit.

## Commands

`restic-backup.sh` creates the boundary-checked local archive and sends that
single archive to the configured repository. `restic-verify.sh` checks the
repository and restores the newest tagged archive into an isolated temporary
directory before running the archive verifier. `restic-prune.sh` is guarded by
`NETCUP_BACKUP_ALLOW_PRUNE=yes` because pruning is destructive to remote
history.

After a successful backup, the service writes the non-secret result summary to
`/var/lib/netcup-backup/last-backup.json` with mode `0600`. That file is safe to
surface as operational evidence; it contains no repository password or cloud
application key.

The systemd templates are intentionally not enabled by the default Ansible
profile. First prove provider ownership, repository recovery, an isolated
restore, and a second administrative path; then install the templates with an
explicit operator change.
