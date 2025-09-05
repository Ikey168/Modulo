const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NoteRegistry", function () {
    let NoteRegistry;
    let noteRegistry;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    // Test data
    const testHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Test note content 1"));
    const testHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Test note content 2"));
    const testHash3 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Test note content 3"));
    const testTitle1 = "My First Note";
    const testTitle2 = "Important Meeting Notes";
    const testTitle3 = "Project Documentation";

    beforeEach(async function () {
        // Get the ContractFactory and Signers here
        NoteRegistry = await ethers.getContractFactory("NoteRegistry");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy a new contract for each test
        noteRegistry = await NoteRegistry.deploy();
        await noteRegistry.deployed();
    });

    describe("Deployment", function () {
        it("Should set the correct initial state", async function () {
            expect(await noteRegistry.getTotalNoteCount()).to.equal(0);
        });
    });

    describe("Note Registration", function () {
        it("Should register a note successfully", async function () {
            const tx = await noteRegistry.registerNote(testHash1, testTitle1);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            
            await expect(tx)
                .to.emit(noteRegistry, "NoteRegistered")
                .withArgs(owner.address, 1, testHash1, testTitle1, block.timestamp);

            expect(await noteRegistry.getTotalNoteCount()).to.equal(1);
        });

        it("Should reject empty hash", async function () {
            const emptyHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
            await expect(
                noteRegistry.registerNote(emptyHash, testTitle1)
            ).to.be.revertedWith("Hash cannot be empty");
        });

        it("Should reject empty title", async function () {
            await expect(
                noteRegistry.registerNote(testHash1, "")
            ).to.be.revertedWith("Title cannot be empty");
        });

        it("Should reject duplicate hashes", async function () {
            await noteRegistry.registerNote(testHash1, testTitle1);
            await expect(
                noteRegistry.registerNote(testHash1, testTitle2)
            ).to.be.revertedWith("Note hash already exists");
        });

        it("Should allow different users to register different notes", async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            await noteRegistry.connect(addr2).registerNote(testHash2, testTitle2);

            expect(await noteRegistry.getTotalNoteCount()).to.equal(2);
            
            const note1 = await noteRegistry.getNote(1);
            const note2 = await noteRegistry.getNote(2);
            
            expect(note1.owner).to.equal(addr1.address);
            expect(note2.owner).to.equal(addr2.address);
        });
    });

    describe("Note Verification", function () {
        beforeEach(async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
        });

        it("Should verify existing note correctly", async function () {
            const [exists, isOwner, isActive] = await noteRegistry.connect(addr1).verifyNote(testHash1);
            expect(exists).to.be.true;
            expect(isOwner).to.be.true;
            expect(isActive).to.be.true;
        });

        it("Should return false for non-owner verification", async function () {
            const [exists, isOwner, isActive] = await noteRegistry.connect(addr2).verifyNote(testHash1);
            expect(exists).to.be.true;
            expect(isOwner).to.be.false;
            expect(isActive).to.be.true;
        });

        it("Should return false for non-existent note", async function () {
            const [exists, isOwner, isActive] = await noteRegistry.verifyNote(testHash2);
            expect(exists).to.be.false;
            expect(isOwner).to.be.false;
            expect(isActive).to.be.false;
        });
    });

    describe("Note Updates", function () {
        beforeEach(async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
        });

        it("Should update note hash successfully", async function () {
            const tx = await noteRegistry.connect(addr1).updateNote(1, testHash2);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            
            await expect(tx)
                .to.emit(noteRegistry, "NoteUpdated")
                .withArgs(addr1.address, 1, testHash2, block.timestamp);

            const note = await noteRegistry.getNote(1);
            expect(note.hash).to.equal(testHash2);
        });

        it("Should reject update from non-owner", async function () {
            await expect(
                noteRegistry.connect(addr2).updateNote(1, testHash2)
            ).to.be.revertedWith("Not the owner of this note");
        });

        it("Should reject update to existing hash", async function () {
            await noteRegistry.connect(addr2).registerNote(testHash2, testTitle2);
            await expect(
                noteRegistry.connect(addr1).updateNote(1, testHash2)
            ).to.be.revertedWith("Note hash already exists");
        });

        it("Should reject update to empty hash", async function () {
            const emptyHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
            await expect(
                noteRegistry.connect(addr1).updateNote(1, emptyHash)
            ).to.be.revertedWith("Hash cannot be empty");
        });
    });

    describe("Note Deactivation", function () {
        beforeEach(async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
        });

        it("Should deactivate note successfully", async function () {
            const tx = await noteRegistry.connect(addr1).deactivateNote(1);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            
            await expect(tx)
                .to.emit(noteRegistry, "NoteDeactivated")
                .withArgs(addr1.address, 1, block.timestamp);

            const note = await noteRegistry.getNote(1);
            expect(note.isActive).to.be.false;
        });

        it("Should reject deactivation from non-owner", async function () {
            await expect(
                noteRegistry.connect(addr2).deactivateNote(1)
            ).to.be.revertedWith("Not the owner of this note");
        });

        it("Should reject operations on deactivated note", async function () {
            await noteRegistry.connect(addr1).deactivateNote(1);
            
            await expect(
                noteRegistry.connect(addr1).updateNote(1, testHash2)
            ).to.be.revertedWith("Note is not active");
        });
    });

    describe("Ownership Transfer", function () {
        beforeEach(async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
        });

        it("Should transfer ownership successfully", async function () {
            await expect(noteRegistry.connect(addr1).transferOwnership(1, addr2.address))
                .to.emit(noteRegistry, "OwnershipTransferred")
                .withArgs(1, addr1.address, addr2.address);

            const note = await noteRegistry.getNote(1);
            expect(note.owner).to.equal(addr2.address);
            
            // Check owner lists
            const addr1Notes = await noteRegistry.getNotesByOwner(addr1.address);
            const addr2Notes = await noteRegistry.getNotesByOwner(addr2.address);
            expect(addr1Notes.length).to.equal(0);
            expect(addr2Notes.length).to.equal(1);
            expect(addr2Notes[0]).to.equal(1);
        });

        it("Should reject transfer from non-owner", async function () {
            await expect(
                noteRegistry.connect(addr2).transferOwnership(1, addr2.address)
            ).to.be.revertedWith("Not the owner of this note");
        });

        it("Should reject transfer to zero address", async function () {
            await expect(
                noteRegistry.connect(addr1).transferOwnership(1, ethers.constants.AddressZero)
            ).to.be.revertedWith("Cannot transfer to zero address");
        });

        it("Should reject transfer to self", async function () {
            await expect(
                noteRegistry.connect(addr1).transferOwnership(1, addr1.address)
            ).to.be.revertedWith("Cannot transfer to yourself");
        });
    });

    describe("Query Functions", function () {
        beforeEach(async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            await noteRegistry.connect(addr1).registerNote(testHash2, testTitle2);
            await noteRegistry.connect(addr2).registerNote(testHash3, testTitle3);
            await noteRegistry.connect(addr1).deactivateNote(2); // Deactivate second note
        });

        it("Should return correct owner notes", async function () {
            const addr1Notes = await noteRegistry.getNotesByOwner(addr1.address);
            const addr2Notes = await noteRegistry.getNotesByOwner(addr2.address);
            
            expect(addr1Notes.length).to.equal(2);
            expect(addr1Notes[0]).to.equal(1);
            expect(addr1Notes[1]).to.equal(2);
            
            expect(addr2Notes.length).to.equal(1);
            expect(addr2Notes[0]).to.equal(3);
        });

        it("Should return correct active note count", async function () {
            expect(await noteRegistry.getActiveNoteCount(addr1.address)).to.equal(1);
            expect(await noteRegistry.getActiveNoteCount(addr2.address)).to.equal(1);
        });

        it("Should get note by hash", async function () {
            const note = await noteRegistry.getNoteByHash(testHash1);
            expect(note.owner).to.equal(addr1.address);
            expect(note.hash).to.equal(testHash1);
            expect(note.title).to.equal(testTitle1);
            expect(note.isActive).to.be.true;
        });

        it("Should check note ownership correctly", async function () {
            expect(await noteRegistry.isNoteOwner(1, addr1.address)).to.be.true;
            expect(await noteRegistry.isNoteOwner(1, addr2.address)).to.be.false;
            expect(await noteRegistry.isNoteOwner(3, addr2.address)).to.be.true;
        });

        it("Should return correct total note count", async function () {
            expect(await noteRegistry.getTotalNoteCount()).to.equal(3);
        });
    });

    describe("Edge Cases", function () {
        it("Should reject operations on non-existent notes", async function () {
            await expect(
                noteRegistry.getNote(999)
            ).to.be.revertedWith("Note does not exist");
            
            await expect(
                noteRegistry.updateNote(999, testHash1)
            ).to.be.revertedWith("Note does not exist");
        });

        it("Should handle empty owner note lists", async function () {
            const notes = await noteRegistry.getNotesByOwner(addr1.address);
            expect(notes.length).to.equal(0);
            
            expect(await noteRegistry.getActiveNoteCount(addr1.address)).to.equal(0);
        });
    });

    // Helper function to get current block timestamp
    async function getBlockTimestamp() {
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        return block.timestamp;
    }
});
