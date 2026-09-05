#!/bin/sh
set -eu
workflow_repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$workflow_repo_dir"
exec mvn -pl backend -am test '-Dtest=WorkflowRunServiceTest#operationsLoadRemainsBoundedAtTenThousandTraces' -Dsurefire.failIfNoSpecifiedTests=false
