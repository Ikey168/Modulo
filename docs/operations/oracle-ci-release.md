# Oracle CI release manifest

The `.github/workflows/oracle-images.yml` workflow checks out the exact Modulo
revision and the pinned public source revisions for Noesis and Praxis, builds
all four application images for `linux/amd64` and `linux/arm64`, publishes
them to GHCR, signs and verifies their digests with GitHub OIDC, and uploads a
deployment manifest.

The reusable or manually dispatched workflow
`.github/workflows/oracle-release-manifest.yml` remains available when trusted
image digests are produced by another pipeline. Both workflows validate the
exact source SHA and digest-pinned image references.

Neither workflow accepts credentials beyond the built-in GitHub Actions token
and OIDC identity, and neither deploys the host. Mutable tags are rejected.
The current pinned external sources are:

- Noesis: `Ikey168/Noesis@a0170965d9d946ad9cc153e5f831670dd34eeb4c`
- Praxis: `KrasForge/Praxis@5ad020825b68cd3cdbe3fd69f4a0b5a613450e8b`

The artifact is consumed on Oracle by the existing release contract:

    ./release.sh <source-sha> <backend@sha256:...> <frontend@sha256:...> \
      <noesis@sha256:...> <praxis@sha256:...>

The generated manifest also records the exact Noesis and Praxis source SHAs
under `sources`, alongside the Modulo `sourceRevision`.

The release script pulls with --no-build, verifies source labels and image
identity, and writes the live deployment manifest. A CI artifact is evidence
of the reviewed inputs; it is not evidence that Oracle has been promoted until
the live release and strict status check pass.
