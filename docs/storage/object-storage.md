# Cloud object-storage policy and operating runbook

This document is the authoritative non-secret contract for large/application
objects in the personal cloud estate. The machine-readable companion is
[`object-storage-inventory.json`](object-storage-inventory.json). Backups,
ordinary files, photos, records, source code and secrets are deliberately out
of scope because they already have different authorities.

## Decision

**Cloudflare R2 is not required immediately.** The decision was reviewed on
2026-09-21 and is intentionally `deferred-until-workload`, not blocked.

Evidence:

- No deployed Modulo or Noesis component currently consumes an S3-compatible
  object API, and neither host has an R2/S3 credential or configured rclone
  remote.
- Modulo attachments use the existing attachment-storage implementation.
  Replacing that backend requires an explicit application migration with dual
  read/write or another rollback-safe cutover; it is not a bucket-provisioning
  side effect.
- Noesis derivatives remain reproducible from their authoritative sources and
  do not need a second canonical object store.
- Restic repositories and off-site backups belong to Backblaze B2. Mixing
  application retention with backup retention would weaken both policies.
- Empty buckets and durable cloud credentials create review, cost and attack
  surface without serving a current producer or consumer.

The Cloud Services & Sync area owner reviews this decision every 180 days and
when any activation trigger in the inventory fires. A trigger starts a scoped
provisioning change; it does not silently make every object class active.

## Data placement boundary

| Data | Authority | Object-storage decision |
| --- | --- | --- |
| Human working files | Nextcloud | Never use R2 as a synchronized folder |
| Photos/video | Immich | Originals remain in Immich's managed storage |
| Code/configuration | Git and IaC | Use releases/registry for build products where applicable |
| Records | Paperless-ngx | Keep document and metadata recovery coherent |
| Notes/tasks/projects | Modulo | Database/application export remains authoritative |
| Modulo attachments | Current attachment storage | Move only through a reviewed backend migration |
| Backups | Restic plus B2 | Never place raw ad hoc dumps in object buckets |
| Large datasets | Object storage after registration | `datasets` class |
| Generated artifacts | Registry/releases first; object storage by exception | `generated-artifacts` class |
| Application binaries | Owning application's metadata database plus objects | `application-objects` class |
| Research outputs | Research manifest plus objects | `research-outputs` class |
| Intentional archives | Archive manifest plus objects | `archives` class |
| Secrets/recovery material | Bitwarden or approved offline custody | Prohibited from these buckets |

An object bucket is not a filesystem, backup plan or source of metadata truth.
Every activated workload must name the metadata authority, deletion authority,
recovery path and cost owner before receiving credentials.

## Bucket and object conventions

Bucket names follow:

```text
kf-<purpose>-<environment>-<location>
```

Names use only lowercase ASCII letters, digits and hyphens, are 3–63
characters, and never encode a person, secret, account number or mutable DNS
name. Candidate production names are:

| Class | Candidate bucket | Activation state |
| --- | --- | --- |
| datasets | `kf-datasets-prod-eu` | Deferred |
| generated artifacts | `kf-artifacts-prod-eu` | Deferred |
| application objects | `kf-app-objects-prod-eu` | Deferred |
| research outputs | `kf-research-prod-eu` | Deferred |
| archives | `kf-archives-prod-eu` | Deferred |

Bucket-name availability is checked during activation; changing a candidate
name requires updating the inventory before provisioning.

Object keys follow:

```text
<producer>/<dataset-or-project>/<yyyy>/<mm>/<immutable-id>/<filename>
```

Rules:

- Use immutable IDs or content digests. Do not rely on overwriting one key as
  version history.
- Use UTF-8 filenames but keep programmatic prefixes conservative and portable.
- Store content type, source reference, creator, creation time, digest,
  sensitivity, retention class and schema version in the authoritative
  manifest. Provider metadata is a cache of that manifest, not its only copy.
- Never use bucket listing as the sole application index.
- Multipart-upload and temporary prefixes must be covered by expiry rules.

## Lifecycle and retention

All new buckets begin in Standard storage. Infrequent Access is considered only
after measured access patterns justify retrieval fees and its minimum-duration
rules. Lifecycle changes are reviewed like destructive code because a mistaken
expiry rule can remove existing objects.

| Class/prefix | Retention |
| --- | --- |
| `datasets/staging/` | Delete after 30 days |
| registered datasets | No automatic expiry; annual owner review |
| `generated-artifacts/tmp/` | Delete after 7 days |
| generated artifacts | Delete after 90 days unless promoted by manifest |
| `application-objects/tmp/` | Delete after 7 days |
| live application objects | Owning application controls deletion |
| orphan quarantine | Delete after 30 days after reconciliation evidence |
| `research-outputs/scratch/` | Delete after 30 days |
| research outputs | Review before deletion after 365 days |
| archives | No automatic expiry; annual owner review |

Provider lifecycle rules are generated from the reviewed inventory only after
the bucket exists. Apply changes to a test prefix first, inspect the resulting
expiration metadata, and preserve a provider-independent manifest before
enabling deletion on existing data.

Object storage is not an independent backup. A canonical object class needs a
separate recovery copy under the backup project before it can hold the sole
copy of valuable data.

## Access, CORS and public exposure

The default for every bucket is private with no CORS rules and no `r2.dev`
endpoint or custom public domain.

Credential rules:

- One bucket-scoped credential per service and environment. Never reuse a
  human administrator token in an application.
- Grant only the required read, write and list operations. Lifecycle, bucket
  deletion and token administration stay on a separate administrative path.
- Keep credential values in Bitwarden or the workload's approved external
  secret store. Do not store them in Git, Modulo notes, images, shell history,
  command-line arguments or rclone examples.
- Rotate every 180 days, on role/service retirement and immediately after
  suspected exposure. Prove the replacement before revoking an old credential
  unless containment requires immediate revocation.
- Browser code never receives permanent S3 credentials. If browser transfer is
  required, the backend issues short-lived, operation-specific presigned URLs.

Public access is a separate reviewed change. It requires a named publication
owner, content classification, custom domain, abuse/cost controls, monitoring,
and proof that no private prefix is reachable. CORS must name exact production
origins and methods; wildcard origins or headers are not accepted by default.

## Provider activation

When a trigger fires:

1. Record the producer, consumers, data authority, expected object count/size,
   request rate, sensitivity, recovery point/time and monthly cost estimate.
2. Select only the required class and confirm the candidate bucket name.
3. Create the bucket through a reviewed provider change and leave public access
   and CORS disabled.
4. Apply the class lifecycle rules first to a disposable test prefix. Confirm
   the provider reports the intended policy.
5. Create separate administrative and workload credentials. Store values only
   in approved custody; record non-secret token names, owners, scopes and
   rotation dates in the inventory/control plane.
6. Configure the workload through environment/secret injection and run a
   write-read-digest-delete test using a disposable object.
7. Add usage, error, credential-expiry and lifecycle monitoring before accepting
   production objects.
8. Establish the independent recovery copy and perform one restore.
9. Update `currentlyApplicable`, the provider/resource identifiers and evidence
   in the inventory. Never add credential values.

For rclone, prefer environment-injected configuration on automation hosts:

```sh
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_REGION=auto
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="from-approved-secret-store"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="from-approved-secret-store"
```

Do not paste real values into a command transcript. Clear the environment after
the operation and ensure the invoking service does not log it.

## Modulo and Noesis integration boundary

No integration is enabled now because no beneficial workload was found.

- Modulo continues to own notes, metadata and its configured attachments. An S3
  attachment backend needs a storage interface, per-user ownership checks,
  presigned/download authorization, dual-read migration and rollback tests.
- Noesis may read registered datasets or research outputs through a read-only,
  prefix-scoped credential. It remains a derivative system and may not mutate
  or become the sole authority for source objects.
- Cross-system metadata belongs in Modulo, while object bytes remain behind the
  owning service. Modulo records provider, bucket, key, digest, size, media type,
  retention class and authority—never cloud credentials.

## Provider migration and exit

The migration helper is
[`scripts/object-storage-migrate.sh`](../../scripts/object-storage-migrate.sh).
It defaults to dry-run, uses `rclone copy` rather than `sync`, never deletes
either side, and performs a downloaded content comparison after `--apply`.

Migration sequence:

1. Create a destination bucket with equivalent private access and reviewed
   lifecycle rules, but keep destination deletion disabled during migration.
2. Export the source object/metadata manifest and record object count, total
   bytes and configuration. Preserve application metadata separately.
3. Give the migration identity read/list on the source and write/list/read on
   the destination—no delete permission.
4. Run the helper without `--apply`; review the dry-run, request volume and cost.
5. Run `--apply` for the initial copy. Its `rclone check --download --one-way`
   verification reads both providers and may incur request/retrieval charges.
6. Freeze writers, repeat the copy and downloaded check, and compare the
   provider-independent manifest.
7. Point one canary consumer to the destination, then cut over the remaining
   consumers. Keep the source read-only for 30 days.
8. Exercise rollback during the retention window. Decommission the source only
   after the owner signs off and legal/retention requirements permit deletion.

Example:

```sh
# Safe preview
scripts/object-storage-migrate.sh old-s3:bucket/prefix r2:bucket/prefix

# Copy and download-verify; does not delete either side
scripts/object-storage-migrate.sh --apply old-s3:bucket/prefix r2:bucket/prefix
```

S3 implementations differ in multipart ETags, checksums, metadata, lifecycle,
object locks and presigned-URL behavior. Download verification and the external
manifest are the portability boundary; do not infer equality from ETag alone.

## Monitoring and review

For each active bucket, monitor:

- stored bytes and object count by class/prefix;
- write/read/list errors and throttling;
- request and retrieval costs against a monthly budget;
- public-access, CORS, lifecycle and credential-policy drift;
- incomplete multipart uploads and temporary-prefix age;
- workload credential age and upcoming rotation;
- reconciliation between application manifests and objects;
- independent backup/restore age and last successful migration check.

Alert immediately on public exposure, policy drift, authentication anomalies,
unexpected deletion growth or a failed restore. Review cost and lifecycle
monthly while active and run a provider-exit copy/check at least annually.

## Acceptance evidence

Completed on 2026-09-21:

- Live source and runtime inventory found no R2/S3 consumer, credential or
  rclone remote, establishing the evidence for deferral.
- Five object classes have explicit names, authority boundaries, prohibited
  content, private defaults and lifecycle rules in the machine-readable
  inventory.
- Least-privilege credential, public access, CORS, browser upload, monitoring,
  recovery and activation contracts are documented.
- The migration helper defaults to dry-run, cannot delete source/destination
  objects, and uses downloaded content verification for cross-provider safety.
- `scripts/test-object-storage-migration.sh` exercises dry-run, copy, downloaded
  verification, repeatability and destination-only-object preservation against
  a loopback S3-compatible endpoint.
- `scripts/verify-object-storage-policy.py` validates the policy structure and
  migration safety boundary.

The project outcome is met without provisioning unused R2 resources. A future
activation is operational work owned by Cloud Services & Sync and must satisfy
the steps above before being called production-ready.

## References

- Cloudflare R2 S3 compatibility:
  <https://developers.cloudflare.com/r2/api/s3/api/>
- Cloudflare R2 bucket creation and naming:
  <https://developers.cloudflare.com/r2/buckets/create-buckets/>
- Cloudflare R2 lifecycle behavior:
  <https://developers.cloudflare.com/r2/buckets/object-lifecycles/>
- Cloudflare R2 public-access defaults:
  <https://developers.cloudflare.com/r2/buckets/public-buckets/>
- Cloudflare R2 CORS and presigned URLs:
  <https://developers.cloudflare.com/r2/buckets/cors/>
- Cloudflare R2 pricing:
  <https://developers.cloudflare.com/r2/pricing/>
- rclone S3 backend and integrity behavior:
  <https://rclone.org/s3/>
- rclone copy semantics:
  <https://rclone.org/commands/rclone_copy/>
- rclone downloaded comparison:
  <https://rclone.org/commands/rclone_check/>
