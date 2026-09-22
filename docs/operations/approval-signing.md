# Approval decision signing

A configured server signs each committed human decision with Ed25519. Signing
and the decision insert share one database transaction: a signing failure leaves
the request pending. With no configured key pair, receipts explicitly say
`UNSIGNED`. Set `modulo.approvals.signing.required=true` to reject startup without
a valid pair. Partially configured or mismatched keys always reject startup.

## Configure and rotate the identity

Generate an Ed25519 private key, export it as unencrypted PKCS#8 DER, and export
the matching public key as X.509 SubjectPublicKeyInfo DER. Mount them as read-only
secret files and configure:

```properties
modulo.approvals.signing.private-key-file=/run/secrets/approval-private.pk8
modulo.approvals.signing.public-key-file=/run/secrets/approval-public.spki
modulo.approvals.signing.required=true
```

Keep the private key outside the database and repository. The key ID is the
SHA-256 fingerprint of the public DER bytes. Publish this fingerprint through a
trusted channel. To rotate, mount a new matching pair and restart the service.
New decisions use the new fingerprint; immutable public-key records and existing
signatures retain the old identity. Rotation does not rewrite old decisions.
Concurrent instances may use different valid identities during rollout.

This is a **server attestation** of an authenticated review, not proof that a
reviewer controlled a personal signing wallet. Wallet signatures are optional
and are not produced by this implementation. No blockchain is required, and no
anchor is claimed.

## Export and verify offline

In decision history, choose **Export decision signature**, or fetch the authorized
`GET /api/approvals/{request}/decisions/{decision}/signature` endpoint. Run:

```sh
node scripts/verify-approval.mjs approval.json TRUSTED_PUBLIC_KEY_SHA256
```

The tool needs only Node's standard cryptographic library and the exported file.
It makes no network request. A mathematically valid signature with an unpinned
key reports `VALID` and `UNTRUSTED_KEY`; it does not establish the key owner's
identity. A matching independently trusted fingerprint reports `TRUSTED_KEY`.
Other results distinguish `TAMPERED`, `UNVERIFIABLE`, and `UNSUPPORTED`. Anchoring
always reports `NOT_VERIFIED`, regardless of claims in the envelope. The UI
likewise distinguishes server or wallet signing claims from local verification.

## Canonical format v1

The signed bytes are UTF-8 JSON for a fixed-order array of strings. There are no
optional elements, numbers, whitespace, or object keys. All strings must be NFC
with valid Unicode scalar values; lone surrogates and decomposed forms are
rejected. Timestamps use UTC with exactly three fractional digits. IDs and
integers are decimal strings or canonical UUID strings. The field order is:

```text
format, keyId, decisionId, requestId, requestRevision, runId, runAttempt,
nodeId, blueprintDigest, evidenceDigest, policyDigest, nonceDigest,
checkpoint, actor, outcome, comment, commentDigest, decidedAt, idempotencyKey
```

`format` is `modulo.approval.decision.v1`. The nonce is represented only by its
SHA-256 digest. Comment text is covered as well as its digest. The signature
covers the complete canonical byte sequence; `digest` is its lowercase SHA-256.
The envelope includes an Ed25519 signature and SPKI public key in standard
base64. Extra statement fields or changed order are rejected.

`shared/approval/vectors.json` contains the same Unicode and signature vector
used by Java and the local Node verifier. `node --test
shared/approval/verification.test.mjs` checks every covered field, malformed
keys/signatures, unsupported versions, and trusted versus untrusted fingerprints.
PostgreSQL tests exercise transaction integration, idempotent signed receipts,
key rotation, authorization, and immutable signature rows.
