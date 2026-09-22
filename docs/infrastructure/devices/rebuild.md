# Device rebuild contract

A replacement device is rebuilt from trusted operating-system media, the
versioned configuration authority, and named state authorities. Machine
identities and credentials are re-enrolled; they are never cloned from a
backup.

1. Confirm the target device, role, boundary, owner, and rollback path.
2. Install a supported operating system and apply security updates.
3. Restore only the role configuration from this repository and the applicable
   infrastructure profile.
4. Re-enrol the device into the private network and create a fresh machine
   identity using the owner-controlled process.
5. Restore state by category, not by copying an entire endpoint filesystem.
6. Run the role verifier, access-negative tests, service health checks, and a
   documented recovery smoke test.
7. Record evidence and keep the old device/state untouched until acceptance.

For `dev-netcup`, the provider customer-control-panel recovery and a
destroy/rebuild exercise are separate gates; this document does not claim them.
