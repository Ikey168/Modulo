# ADR 0001: Recipient encryption keys for end-to-end encrypted sharing

- **Status:** Accepted
- **Context:** [#239](https://github.com/Ikey168/Modulo/issues/239), part of the
  encrypted-sharing epic [#243](https://github.com/Ikey168/Modulo/issues/243)
- **Decision drivers:** wallet compatibility, longevity, and keeping note
  decryption keys off any trusted server.

## Context

To share an encrypted note, the per-note symmetric key (see the `noteCrypto`
module) must be wrapped (encrypted) so only the intended recipient can unwrap
it. That requires each user to have an asymmetric **encryption** keypair whose
public key senders can wrap to. Ethereum wallet keys are secp256k1 signing
keys, not encryption keys, so we need a separate mechanism.

Two options were considered.

### Option A — MetaMask native RPCs (`eth_getEncryptionPublicKey` / `eth_decrypt`)

The sender fetches the recipient's X25519 public key via
`eth_getEncryptionPublicKey` and wraps to it with `x25519-xsalsa20-poly1305`;
the recipient decrypts via `eth_decrypt`, with the private key never leaving the
wallet.

- Pro: private key stays in the wallet.
- Con: **both RPCs are deprecated by MetaMask** and may be removed.
- Con: effectively MetaMask-only — not supported by most other wallets, hardware
  wallets, or WalletConnect. Poor cross-wallet UX.

### Option B — Signature-derived X25519 keypair (chosen)

The user signs a fixed, versioned message (`ENCRYPTION_KEY_MESSAGE`) with their
wallet. The signature is hashed (SHA-512, truncated to 32 bytes) into an X25519
secret scalar, yielding a stable keypair (`deriveEncryptionKeyPair`). The
**public** key is published (later, on-chain via #240); the secret key is
re-derived on demand from the signature.

- Pro: works with **any** wallet that can sign a message (`personal_sign`).
- Pro: uses no deprecated RPCs.
- Pro: wrapping uses the same `x25519-xsalsa20-poly1305` sealed-box scheme, so
  the wrapped blob stays format-compatible with MetaMask's `EthEncryptedData`.
- Con: the wallet must produce a **deterministic** signature for a fixed message
  (true for MetaMask and RFC-6979 ECDSA wallets). See the caveat below.
- Con: the X25519 secret exists in app memory during a session (derived from the
  signature), rather than living only inside the wallet.

## Decision

Adopt **Option B (signature-derived X25519 keypair)**. The deprecation of the
MetaMask RPCs and the cross-wallet requirement outweigh Option A's
wallet-custody advantage.

## Consequences

- `recipientKeys.ts` implements derivation (`deriveEncryptionKeyPair`,
  `deriveEncryptionKeyPairFromWallet`), wrapping (`wrapKeyForRecipient`), and
  unwrapping (`unwrapKey`) on top of `tweetnacl`.
- #240 stores each recipient's published X25519 public key and the per-recipient
  wrapped key + CID; #241 wires the recipient decryption flow.
- The signing message is **versioned** (`v1`); bumping it rotates everyone's
  derived keypair, so changes must be deliberate and migrated.

### Determinism caveat

Key re-derivation relies on the wallet returning the **same** signature for the
same message every time. This holds for MetaMask and other RFC-6979
deterministic-ECDSA wallets. Wallets that sign with non-deterministic nonces
would derive a different keypair each time and could not decrypt previously
shared notes. Mitigation if we hit such a wallet: derive once and persist the
keypair locally (e.g. in IndexedDB), instead of re-deriving each session.
