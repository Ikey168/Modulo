# Personal data inventory

`inventory.json` is the non-secret classification of state relevant to the
Netcup development environment and its recovery boundary. It identifies the
authoritative location, whether a dataset is source/state/cache/configuration,
and the restore method without copying credentials or private contents.

The inventory is deliberately separate from backup credentials. A record of a
planned or owner-gated backup is not evidence that the remote repository or its
restore path has been tested.
