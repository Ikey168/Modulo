const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NoteRegistryWithAccessControl", function () {
  let noteRegistry;
  let owner, user1, user2, user3;
  let noteId;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const NoteRegistryWithAccessControl = await ethers.getContractFactory("NoteRegistryWithAccessControl");
    noteRegistry = await NoteRegistryWithAccessControl.deploy();
    await noteRegistry.deployed();

    // Register a test note
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test content"));
    const tx = await noteRegistry.connect(owner).registerNote(hash, "Test Note", false);
    const receipt = await tx.wait();
    noteId = receipt.events[0].args.noteId;
  });

  describe("Basic Note Registration", function () {
    it("Should register a note with access control features", async function () {
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new content"));
      
      await expect(noteRegistry.connect(user1).registerNote(hash, "New Note", true))
        .to.emit(noteRegistry, "NoteRegistered")
        .withArgs(user1.address, 2, hash, "New Note", await getLatestTimestamp(), true);

      const note = await noteRegistry.connect(user1).getNote(2);
      expect(note.owner).to.equal(user1.address);
      expect(note.isPublic).to.be.true;
    });

    it("Should not allow duplicate hashes", async function () {
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test content"));
      
      await expect(noteRegistry.connect(user1).registerNote(hash, "Duplicate", false))
        .to.be.revertedWith("Note hash already exists");
    });
  });

  describe("Permission Management", function () {
    it("Should grant read permission", async function () {
      await expect(noteRegistry.connect(owner).grantPermission(noteId, user1.address, 1)) // READ = 1
        .to.emit(noteRegistry, "PermissionGranted")
        .withArgs(noteId, user1.address, owner.address, 1, await getLatestTimestamp());

      const permission = await noteRegistry.getPermission(noteId, user1.address);
      expect(permission).to.equal(1); // READ
    });

    it("Should grant write permission", async function () {
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 2); // WRITE = 2

      const permission = await noteRegistry.getPermission(noteId, user1.address);
      expect(permission).to.equal(2); // WRITE
    });

    it("Should grant admin permission", async function () {
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 3); // ADMIN = 3

      const permission = await noteRegistry.getPermission(noteId, user1.address);
      expect(permission).to.equal(3); // ADMIN
    });

    it("Should revoke permission", async function () {
      // Grant permission first
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 2); // WRITE
      
      // Revoke permission
      await expect(noteRegistry.connect(owner).revokePermission(noteId, user1.address))
        .to.emit(noteRegistry, "PermissionRevoked")
        .withArgs(noteId, user1.address, owner.address, await getLatestTimestamp());

      const permission = await noteRegistry.getPermission(noteId, user1.address);
      expect(permission).to.equal(0); // NONE
    });

    it("Should not allow non-admin to grant permissions", async function () {
      await expect(noteRegistry.connect(user1).grantPermission(noteId, user2.address, 1))
        .to.be.revertedWith("No admin permission");
    });

    it("Should allow admin-level collaborator to grant permissions", async function () {
      // Owner grants admin permission to user1
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 3); // ADMIN
      
      // user1 can now grant permissions
      await expect(noteRegistry.connect(user1).grantPermission(noteId, user2.address, 1))
        .to.emit(noteRegistry, "PermissionGranted");
    });
  });

  describe("Access Control Enforcement", function () {
    it("Should allow owner to read note", async function () {
      const note = await noteRegistry.connect(owner).getNote(noteId);
      expect(note.owner).to.equal(owner.address);
    });

    it("Should prevent unauthorized read access to private note", async function () {
      await expect(noteRegistry.connect(user1).getNote(noteId))
        .to.be.revertedWith("No read permission");
    });

    it("Should allow read access with READ permission", async function () {
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 1); // READ
      
      const note = await noteRegistry.connect(user1).getNote(noteId);
      expect(note.owner).to.equal(owner.address);
    });

    it("Should allow read access to public notes", async function () {
      // Create a public note
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("public content"));
      const tx = await noteRegistry.connect(owner).registerNote(hash, "Public Note", true);
      const receipt = await tx.wait();
      const publicNoteId = receipt.events[0].args.noteId;

      // Anyone should be able to read public notes
      const note = await noteRegistry.connect(user1).getNote(publicNoteId);
      expect(note.isPublic).to.be.true;
    });

    it("Should prevent unauthorized write access", async function () {
      const newHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("updated content"));
      
      await expect(noteRegistry.connect(user1).updateNote(noteId, newHash))
        .to.be.revertedWith("No write permission");
    });

    it("Should allow write access with WRITE permission", async function () {
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 2); // WRITE
      
      const newHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("updated content"));
      await expect(noteRegistry.connect(user1).updateNote(noteId, newHash))
        .to.emit(noteRegistry, "NoteUpdated");
    });

    it("Should allow write access with ADMIN permission", async function () {
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 3); // ADMIN
      
      const newHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("admin updated content"));
      await expect(noteRegistry.connect(user1).updateNote(noteId, newHash))
        .to.emit(noteRegistry, "NoteUpdated");
    });
  });

  describe("Visibility Management", function () {
    it("Should allow owner to change note visibility", async function () {
      await expect(noteRegistry.connect(owner).setNoteVisibility(noteId, true))
        .to.emit(noteRegistry, "NoteVisibilityChanged")
        .withArgs(noteId, true, await getLatestTimestamp());

      const note = await noteRegistry.connect(owner).getNote(noteId);
      expect(note.isPublic).to.be.true;
    });

    it("Should not allow non-owner to change visibility", async function () {
      await expect(noteRegistry.connect(user1).setNoteVisibility(noteId, true))
        .to.be.revertedWith("Not the owner of this note");
    });
  });

  describe("Collaborator Management", function () {
    beforeEach(async function () {
      // Grant different permissions to different users
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 1); // READ
      await noteRegistry.connect(owner).grantPermission(noteId, user2.address, 2); // WRITE
      await noteRegistry.connect(owner).grantPermission(noteId, user3.address, 3); // ADMIN
    });

    it("Should return all collaborators", async function () {
      const collaborators = await noteRegistry.connect(owner).getNoteCollaborators(noteId);
      expect(collaborators).to.deep.equal([user1.address, user2.address, user3.address]);
    });

    it("Should return permission details", async function () {
      const permissionDetails = await noteRegistry.connect(owner).getPermissionDetails(noteId, user2.address);
      expect(permissionDetails.level).to.equal(2); // WRITE
      expect(permissionDetails.grantedBy).to.equal(owner.address);
    });

    it("Should check specific permission levels", async function () {
      expect(await noteRegistry.hasPermission(noteId, user1.address, 1)).to.be.true; // READ
      expect(await noteRegistry.hasPermission(noteId, user1.address, 2)).to.be.false; // WRITE
      expect(await noteRegistry.hasPermission(noteId, user2.address, 2)).to.be.true; // WRITE
      expect(await noteRegistry.hasPermission(noteId, user3.address, 3)).to.be.true; // ADMIN
    });
  });

  describe("Advanced Access Control", function () {
    it("Should verify note access correctly", async function () {
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test content"));
      
      // Owner should have full access
      const ownerAccess = await noteRegistry.connect(owner).verifyNoteAccess(hash);
      expect(ownerAccess.exists).to.be.true;
      expect(ownerAccess.hasReadAccess).to.be.true;
      expect(ownerAccess.hasWriteAccess).to.be.true;
      expect(ownerAccess.isActive).to.be.true;

      // User without permissions should have no access
      const userAccess = await noteRegistry.connect(user1).verifyNoteAccess(hash);
      expect(userAccess.exists).to.be.true;
      expect(userAccess.hasReadAccess).to.be.false;
      expect(userAccess.hasWriteAccess).to.be.false;
      expect(userAccess.isActive).to.be.true;
    });

    it("Should return accessible notes for user", async function () {
      // Create another note owned by user1
      const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("user1 content"));
      await noteRegistry.connect(user1).registerNote(hash2, "User1 Note", false);

      // Grant user1 read access to owner's note
      await noteRegistry.connect(owner).grantPermission(noteId, user1.address, 1); // READ

      const accessibleNotes = await noteRegistry.getAccessibleNotes(user1.address);
      expect(accessibleNotes.length).to.equal(2); // Own note + permitted note
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should not allow granting permissions to zero address", async function () {
      await expect(noteRegistry.connect(owner).grantPermission(noteId, ethers.constants.AddressZero, 1))
        .to.be.revertedWith("Cannot grant to zero address");
    });

    it("Should not allow granting permissions to owner", async function () {
      await expect(noteRegistry.connect(owner).grantPermission(noteId, owner.address, 1))
        .to.be.revertedWith("Owner already has all permissions");
    });

    it("Should not allow revoking owner permissions", async function () {
      await expect(noteRegistry.connect(owner).revokePermission(noteId, owner.address))
        .to.be.revertedWith("Cannot revoke owner permissions");
    });

    it("Should handle permission operations on non-existent notes", async function () {
      await expect(noteRegistry.connect(owner).grantPermission(999, user1.address, 1))
        .to.be.revertedWith("Note does not exist");
    });

    it("Should handle deactivated notes correctly", async function () {
      // Deactivate the note
      await noteRegistry.connect(owner).deactivateNote(noteId);

      // Should not allow new permissions on deactivated notes
      await expect(noteRegistry.connect(owner).grantPermission(noteId, user1.address, 1))
        .to.be.revertedWith("Note is not active");
    });
  });

  // Helper function to get latest block timestamp
  async function getLatestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + 1; // Add 1 for next block
  }
});
