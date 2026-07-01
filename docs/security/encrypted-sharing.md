# Encrypted note sharing — security model

Status: **design + partial implementation** (epic
[#243](https://github.com/Ikey168/Modulo/issues/243)). This document is the
security model and threat model for the end-to-end encrypted sharing feature.
Until the review checklist at the end is signed off, shared/anchored notes
**must not** be advertised as confidential.

## 1. Current state vs. target

| Aspect | Current (`main`) | Target (this epic) |
| --- | --- | --- |
| Note content at rest | Plaintext in PostgreSQL; plaintext on IPFS if published | Ciphertext only on IPFS; see §6 for the DB |
| Encryption | None | AES-256-GCM, per-note key, encrypted on the client (#238) |
| Key sharing | None | Per-recipient wrapped key, X25519 sealed box (#239) |
| On-chain | SHA-256 content hash (integrity/authorship) | + CID and per-recipient wrapped keys (#240) |
| Who can read a shared note | Anyone with the CID | Only the wrapped-key recipients (#241) |

The blockchain layer provides **integrity and provenance**, not
confidentiality. Confidentiality comes entirely from client-side encryption.

## 2. Trust assumptions

- **IPFS is public.** Any object (by CID) can be fetched by anyone, forever
  once pinned/propagated. Only ciphertext may be uploaded.
- **On-chain storage is public and permanent.** Everything written to the
  contract — CIDs, wrapped keys, collaborator addresses, titles, timestamps —
  is world-readable and cannot be deleted. Store only values that are safe to
  publish (wrapped keys are useless without the recipient secret).
- **The backend/database are untrusted for confidentiality of shared notes.**
  The server relays ciphertext to IPFS and never holds a note key. A compromised
  backend or stolen DB dump must not yield the plaintext of an encrypted note.
- **The user's wallet is trusted** to sign and to keep its signing key secret.
- **The client device is trusted** while a note is open (plaintext and derived
  keys exist in memory there).

## 3. Key custody

- **Per-note symmetric key** (AES-256-GCM): generated on the device, exists in
  memory while editing/reading, and is shared only by wrapping it to recipients.
  It is never sent to the server in the clear.
- **Recipient encryption keypair** (X25519): **derived from a wallet
  signature** over a fixed, versioned message
  ([ADR&nbsp;0001](../architecture/adr-0001-encryption-key-derivation.md)),
  not stored server-side. The public key is publishable; the secret is
  re-derived on demand and lives only in client memory.

What an attacker gets:

| Attacker | Can read shared-note plaintext? |
| --- | --- |
| Compromised backend / stolen Postgres dump | **No** (only ciphertext relayed; no keys held) |
| Anyone scraping IPFS by CID | **No** (ciphertext only) |
| Anyone reading the chain | **No** (only wrapped keys; needs a recipient secret) |
| A revoked recipient, for **future** versions | **No** (key rotated; see §4) |
| A revoked recipient, for content they **already** fetched | **Yes** — cannot be un-disclosed (see §4) |
| Someone who compromises a recipient's wallet | **Yes**, for notes shared with that recipient |

## 4. Revocation and key rotation

Because IPFS objects and on-chain data are public and permanent, deleting an
on-chain grant does not retract anything a recipient already downloaded, nor
remove the ciphertext. **Revocation is cryptographic, not just an ACL change.**

On revoke (implemented by `reEncryptAndRewrap`, #242, + the contract calls from
#240):

1. Generate a **new** note key and re-encrypt the note → **new CID**.
2. Re-wrap the new key for the **remaining** recipients only.
3. On-chain: `setNoteCid(noteId, newCid)`, `grantAccess(...)` for each remaining
   recipient with their new wrapped key, and `revokeAccess(noteId, revoked)`.

Guarantees and limits:

- **Future content is protected:** the revoked party has no wrapped copy of the
  new key and cannot read any version published after revocation.
- **Past content cannot be un-disclosed:** anything the revoked party already
  fetched and decrypted (or simply cached the ciphertext + had the old key for)
  remains readable to them. This is inherent to public, permanent storage and
  must be communicated in the UI.

This is covered by tests in `keyRotation.test.ts`: remaining recipients decrypt
the new version, the revoked recipient has no wrapped key, and the old key
cannot decrypt the new ciphertext.

## 5. Metadata leakage

Confidentiality protects note **bodies**, not necessarily metadata. The
following are currently visible:

- **On-chain:** note id, owner and collaborator **addresses**, CID, timestamps,
  and (in `NoteRegistry`) the note **title** and content hash.
- **In Postgres:** title, tags, and relationships, unless §6 changes that.

Decisions required before "confidential" sign-off:

- [ ] Stop writing the **title** on-chain for encrypted notes (or wrap it).
- [ ] Treat collaborator addresses + the social graph as disclosed; document it.
- [ ] Decide whether the CID itself needs hiding (a CID reveals ciphertext size
      and lets anyone fetch the blob — acceptable since it's ciphertext, but it
      links recipients to a note).

## 6. Database handling

If a note is meant to be confidential, storing its plaintext in Postgres
defeats the purpose for the "stolen DB" threat. Decide per the product:

- [ ] For encrypted/shared notes, store **only ciphertext or nothing** server
      side (the source of truth is IPFS), **or**
- [ ] Explicitly scope the feature as "encrypted in transit/at rest on IPFS,
      but the owner's server copy is plaintext," and document that the DB is in
      the trust boundary for the owner's own notes.

## 7. Known risks

- **Deprecated MetaMask RPCs.** We deliberately avoid
  `eth_getEncryptionPublicKey` / `eth_decrypt` (deprecated) in favor of the
  signature-derived keypair (ADR 0001). Residual risk: the derivation relies on
  **deterministic** wallet signatures; non-deterministic wallets would derive a
  different key each time. Mitigation: derive once and persist the keypair
  locally for such wallets.
- **Client device compromise** exposes open notes and derived keys; out of scope
  to fully mitigate.
- **No forward secrecy within a version:** a recipient who keeps a note key can
  read every version published under that key until it is rotated.

## 8. Review checklist (gate for advertising confidentiality)

- [ ] Client-side encryption wired into the create/update + upload path (#238).
- [ ] Recipient key derivation + wrapping wired to the wallet (#239).
- [ ] Contract deployed; CID + wrapped keys read/written by the app (#240/#241).
- [ ] Revocation performs key rotation per §4 (#242 helper wired in).
- [ ] Metadata decisions in §5 made and implemented.
- [ ] Database handling decision in §6 made and implemented.
- [ ] Independent security review of the crypto + flows signed off.

Until every box is checked, the UI and docs must describe sharing as
**integrity/provenance + experimental encryption**, not guaranteed
confidentiality (see the README "Data protection" note).
