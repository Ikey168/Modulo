# OCI deployment contract

This directory is the source location for the Oracle deployment contract used
by the local operations gate. The current repository contains the application,
container, Terraform, and recovery authorities needed to build a deployment,
but it does not contain provider credentials or claim that a live Oracle
instance has been rebuilt by this check.

`tests/` is intentionally structural and offline. Provider provisioning,
secret injection, database restore, and live acceptance remain explicit
operator-run steps.
