const { expect } = require("chai");
const { ethers } = require("hardhat");

// Tests for the encrypted-sharing additions to NoteRegistryWithAccessControl
// (epic #243, issue #240): per-note CID + per-recipient wrapped keys with
// grant/revoke and recipient reads.
describe("NoteRegistryWithAccessControl - encrypted sharing", function () {
  let registry;
  let owner, recipient, other;
  let noteId;

  const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const wrappedKey = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("wrapped-key-for-recipient"));

  beforeEach(async function () {
    [owner, recipient, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("NoteRegistryWithAccessControl");
    registry = await Factory.deploy();
    await registry.deployed();

    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ciphertext-hash"));
    const tx = await registry.connect(owner).registerNote(hash, "Shared Note", false);
    const receipt = await tx.wait();
    noteId = receipt.events[0].args.noteId;
  });

  describe("setNoteCid", function () {
    it("lets the owner set the ciphertext CID", async function () {
      await expect(registry.connect(owner).setNoteCid(noteId, CID))
        .to.emit(registry, "NoteCidSet");
      expect(await registry.noteCid(noteId)).to.equal(CID);
    });

    it("rejects a non-owner", async function () {
      await expect(registry.connect(other).setNoteCid(noteId, CID))
        .to.be.revertedWith("Not the owner of this note");
    });

    it("rejects an empty CID", async function () {
      await expect(registry.connect(owner).setNoteCid(noteId, ""))
        .to.be.revertedWith("CID cannot be empty");
    });
  });

  describe("grantAccess / getSharedNote", function () {
    beforeEach(async function () {
      await registry.connect(owner).setNoteCid(noteId, CID);
    });

    it("grants access so the recipient can read the CID + wrapped key", async function () {
      await expect(registry.connect(owner).grantAccess(noteId, recipient.address, wrappedKey))
        .to.emit(registry, "AccessGranted");

      const res = await registry.connect(recipient).getSharedNote(noteId);
      expect(res.cid).to.equal(CID);
      expect(res.wrappedKey).to.equal(wrappedKey);
      expect(await registry.getPermission(noteId, recipient.address)).to.equal(1); // READ
    });

    it("denies a non-grantee any read", async function () {
      await registry.connect(owner).grantAccess(noteId, recipient.address, wrappedKey);
      await expect(registry.connect(other).getSharedNote(noteId))
        .to.be.revertedWith("No read access");
    });

    it("returns the CID with an empty wrapped key to the owner", async function () {
      await registry.connect(owner).grantAccess(noteId, recipient.address, wrappedKey);
      const res = await registry.connect(owner).getSharedNote(noteId);
      expect(res.cid).to.equal(CID);
      expect(res.wrappedKey).to.equal("0x");
    });

    it("rejects a grant from a non-admin", async function () {
      await expect(registry.connect(other).grantAccess(noteId, recipient.address, wrappedKey))
        .to.be.revertedWith("No admin permission");
    });

    it("rejects an empty wrapped key", async function () {
      await expect(registry.connect(owner).grantAccess(noteId, recipient.address, "0x"))
        .to.be.revertedWith("Wrapped key required");
    });

    it("rejects granting to the owner", async function () {
      await expect(registry.connect(owner).grantAccess(noteId, owner.address, wrappedKey))
        .to.be.revertedWith("Owner already has access");
    });

    it("re-grant rotates the wrapped key without duplicating the collaborator", async function () {
      await registry.connect(owner).grantAccess(noteId, recipient.address, wrappedKey);

      const rotated = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("rotated-wrapped-key"));
      await registry.connect(owner).grantAccess(noteId, recipient.address, rotated);

      const res = await registry.connect(recipient).getSharedNote(noteId);
      expect(res.wrappedKey).to.equal(rotated);

      const collaborators = await registry.connect(owner).getNoteCollaborators(noteId);
      const matches = collaborators.filter((a) => a === recipient.address);
      expect(matches.length).to.equal(1);
    });

    it("lets the recipient read their own wrapped key via getWrappedKey", async function () {
      await registry.connect(owner).grantAccess(noteId, recipient.address, wrappedKey);
      expect(await registry.connect(recipient).getWrappedKey(noteId, recipient.address)).to.equal(wrappedKey);
    });

    it("blocks an unrelated account from getWrappedKey", async function () {
      await registry.connect(owner).grantAccess(noteId, recipient.address, wrappedKey);
      await expect(registry.connect(other).getWrappedKey(noteId, recipient.address))
        .to.be.revertedWith("Not authorized");
    });
  });

  describe("revokeAccess", function () {
    beforeEach(async function () {
      await registry.connect(owner).setNoteCid(noteId, CID);
      await registry.connect(owner).grantAccess(noteId, recipient.address, wrappedKey);
    });

    it("revokes access and clears the wrapped key", async function () {
      await expect(registry.connect(owner).revokeAccess(noteId, recipient.address))
        .to.emit(registry, "AccessRevoked");

      await expect(registry.connect(recipient).getSharedNote(noteId))
        .to.be.revertedWith("No read access");
      expect(await registry.getPermission(noteId, recipient.address)).to.equal(0); // NONE
    });

    it("rejects revoking a non-grantee", async function () {
      await expect(registry.connect(owner).revokeAccess(noteId, other.address))
        .to.be.revertedWith("No access to revoke");
    });

    it("rejects revocation by a non-admin", async function () {
      await expect(registry.connect(other).revokeAccess(noteId, recipient.address))
        .to.be.revertedWith("No admin permission");
    });
  });
});
