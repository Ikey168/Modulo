const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NoteRegistry - Enhanced Branch Coverage", function () {
    let NoteRegistry;
    let noteRegistry;
    let owner;
    let user1;
    let user2;

    const sampleHash = "0x1234567890123456789012345678901234567890123456789012345678901234";
    const sampleHash2 = "0x2345678901234567890123456789012345678901234567890123456789012345";
    const sampleTitle = "Sample Note";
    const sampleTitle2 = "Another Note";

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        NoteRegistry = await ethers.getContractFactory("NoteRegistry");
        noteRegistry = await NoteRegistry.deploy();
        await noteRegistry.deployed();
    });

    describe("Initial State and Deployment", function () {
        it("Should set the correct initial state", async function () {
            const totalNotes = await noteRegistry.totalNotes();
            expect(totalNotes.toString()).to.equal("0");
            
            const activeNotes = await noteRegistry.getActiveNoteCount();
            expect(activeNotes.toString()).to.equal("0");
        });

        it("Should initialize with zero notes for any user", async function () {
            const user1Notes = await noteRegistry.getOwnerNoteCount(user1.address);
            const user2Notes = await noteRegistry.getOwnerNoteCount(user2.address);
            expect(user1Notes.toString()).to.equal("0");
            expect(user2Notes.toString()).to.equal("0");
        });
    });

    describe("Note Registration - Enhanced Coverage", function () {
        it("Should register a note successfully", async function () {
            const tx = await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            const receipt = await tx.wait();
            
            // Check for event emission
            const noteRegisteredEvent = receipt.events?.find(e => e.event === 'NoteRegistered');
            expect(noteRegisteredEvent).to.exist;
            expect(noteRegisteredEvent.args.noteId.toString()).to.equal("1");
            expect(noteRegisteredEvent.args.owner).to.equal(user1.address);
            expect(noteRegisteredEvent.args.hash).to.equal(sampleHash);
            expect(noteRegisteredEvent.args.title).to.equal(sampleTitle);
            
            // Verify note was added to user's collection
            const userNotes = await noteRegistry.getOwnerNoteCount(user1.address);
            expect(userNotes.toString()).to.equal("1");
            
            // Verify total notes increased
            const totalNotes = await noteRegistry.totalNotes();
            expect(totalNotes.toString()).to.equal("1");
        });

        it("Should reject empty hash", async function () {
            try {
                await noteRegistry.connect(user1).registerNote("0x0000000000000000000000000000000000000000000000000000000000000000", sampleTitle);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Hash cannot be empty");
            }
        });

        it("Should reject empty title", async function () {
            try {
                await noteRegistry.connect(user1).registerNote(sampleHash, "");
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Title cannot be empty");
            }
        });

        it("Should reject duplicate hashes", async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            
            try {
                await noteRegistry.connect(user2).registerNote(sampleHash, sampleTitle2);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Hash already exists");
            }
        });

        it("Should allow different users to register different notes", async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            await noteRegistry.connect(user2).registerNote(sampleHash2, sampleTitle2);
            
            const totalNotes = await noteRegistry.totalNotes();
            expect(totalNotes.toString()).to.equal("2");
            
            const user1Notes = await noteRegistry.getOwnerNoteCount(user1.address);
            const user2Notes = await noteRegistry.getOwnerNoteCount(user2.address);
            expect(user1Notes.toString()).to.equal("1");
            expect(user2Notes.toString()).to.equal("1");
        });

        it("Should handle registration with same title but different hash", async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            await noteRegistry.connect(user2).registerNote(sampleHash2, sampleTitle); // Same title, different hash
            
            const totalNotes = await noteRegistry.totalNotes();
            expect(totalNotes.toString()).to.equal("2");
        });

        it("Should handle maximum hash value", async function () {
            const maxHash = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
            await noteRegistry.connect(user1).registerNote(maxHash, sampleTitle);
            
            const userNotes = await noteRegistry.getOwnerNoteCount(user1.address);
            expect(userNotes.toString()).to.equal("1");
        });
    });

    describe("Note Verification - Branch Coverage", function () {
        beforeEach(async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
        });

        it("Should verify existing note correctly", async function () {
            const result = await noteRegistry.verifyNote(sampleHash);
            expect(result.exists).to.be.true;
            expect(result.isOwner).to.be.false; // Called by owner contract, not user1
            expect(result.isActive).to.be.true;
        });

        it("Should verify note ownership correctly", async function () {
            const isOwner = await noteRegistry.connect(user1).isNoteOwner(1, user1.address);
            expect(isOwner).to.be.true;
            
            const isNotOwner = await noteRegistry.connect(user2).isNoteOwner(1, user2.address);
            expect(isNotOwner).to.be.false;
        });

        it("Should return false for non-owner verification", async function () {
            const result = await noteRegistry.connect(user2).verifyNote(sampleHash);
            expect(result.exists).to.be.true;
            expect(result.isOwner).to.be.false;
            expect(result.isActive).to.be.true;
        });

        it("Should return false for non-existent note", async function () {
            const nonExistentHash = "0x9999999999999999999999999999999999999999999999999999999999999999";
            const result = await noteRegistry.verifyNote(nonExistentHash);
            expect(result.exists).to.be.false;
            expect(result.isOwner).to.be.false;
            expect(result.isActive).to.be.false;
        });

        it("Should handle zero address in ownership check", async function () {
            try {
                await noteRegistry.isNoteOwner(1, ethers.constants.AddressZero);
                // This might not revert, so check the result
                const isOwner = await noteRegistry.isNoteOwner(1, ethers.constants.AddressZero);
                expect(isOwner).to.be.false;
            } catch (error) {
                // If it reverts, that's also acceptable behavior
                expect(error.message).to.include("revert");
            }
        });
    });

    describe("Note Updates - Enhanced Branch Coverage", function () {
        beforeEach(async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
        });

        it("Should update note hash successfully", async function () {
            const newHash = "0x3333333333333333333333333333333333333333333333333333333333333333";
            
            const tx = await noteRegistry.connect(user1).updateNoteHash(1, newHash);
            const receipt = await tx.wait();
            
            const updateEvent = receipt.events?.find(e => e.event === 'NoteUpdated');
            expect(updateEvent).to.exist;
            expect(updateEvent.args.noteId.toString()).to.equal("1");
            expect(updateEvent.args.newHash).to.equal(newHash);
            
            // Verify the hash was updated
            const result = await noteRegistry.verifyNote(newHash);
            expect(result.exists).to.be.true;
            
            // Old hash should no longer exist
            const oldResult = await noteRegistry.verifyNote(sampleHash);
            expect(oldResult.exists).to.be.false;
        });

        it("Should reject update from non-owner", async function () {
            const newHash = "0x3333333333333333333333333333333333333333333333333333333333333333";
            
            try {
                await noteRegistry.connect(user2).updateNoteHash(1, newHash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Only the owner can update this note");
            }
        });

        it("Should reject update to existing hash", async function () {
            // Register another note first
            await noteRegistry.connect(user2).registerNote(sampleHash2, sampleTitle2);
            
            try {
                await noteRegistry.connect(user1).updateNoteHash(1, sampleHash2);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Hash already exists");
            }
        });

        it("Should reject update to empty hash", async function () {
            try {
                await noteRegistry.connect(user1).updateNoteHash(1, "0x0000000000000000000000000000000000000000000000000000000000000000");
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Hash cannot be empty");
            }
        });

        it("Should reject update of non-existent note", async function () {
            const newHash = "0x3333333333333333333333333333333333333333333333333333333333333333";
            
            try {
                await noteRegistry.connect(user1).updateNoteHash(999, newHash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
        });

        it("Should allow updating to same hash (no-op)", async function () {
            // This should succeed without changes
            await noteRegistry.connect(user1).updateNoteHash(1, sampleHash);
            
            const result = await noteRegistry.verifyNote(sampleHash);
            expect(result.exists).to.be.true;
        });
    });

    describe("Note Deactivation - Branch Coverage", function () {
        beforeEach(async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
        });

        it("Should deactivate note successfully", async function () {
            const tx = await noteRegistry.connect(user1).deactivateNote(1);
            const receipt = await tx.wait();
            
            const deactivateEvent = receipt.events?.find(e => e.event === 'NoteDeactivated');
            expect(deactivateEvent).to.exist;
            expect(deactivateEvent.args.noteId.toString()).to.equal("1");
            
            // Note should still exist but be inactive
            const result = await noteRegistry.verifyNote(sampleHash);
            expect(result.exists).to.be.true;
            expect(result.isActive).to.be.false;
            
            // Active count should decrease
            const activeCount = await noteRegistry.getActiveNoteCount();
            expect(activeCount.toString()).to.equal("0");
        });

        it("Should reject deactivation from non-owner", async function () {
            try {
                await noteRegistry.connect(user2).deactivateNote(1);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Only the owner can deactivate this note");
            }
        });

        it("Should reject operations on deactivated note", async function () {
            await noteRegistry.connect(user1).deactivateNote(1);
            
            const newHash = "0x3333333333333333333333333333333333333333333333333333333333333333";
            try {
                await noteRegistry.connect(user1).updateNoteHash(1, newHash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note is not active");
            }
        });

        it("Should reject deactivation of non-existent note", async function () {
            try {
                await noteRegistry.connect(user1).deactivateNote(999);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
        });

        it("Should handle multiple deactivations", async function () {
            await noteRegistry.connect(user1).deactivateNote(1);
            
            // Second deactivation should still work (no-op)
            await noteRegistry.connect(user1).deactivateNote(1);
            
            const result = await noteRegistry.verifyNote(sampleHash);
            expect(result.isActive).to.be.false;
        });
    });

    describe("Ownership Transfer - Enhanced Coverage", function () {
        beforeEach(async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
        });

        it("Should transfer ownership successfully", async function () {
            const tx = await noteRegistry.connect(user1).transferNoteOwnership(1, user2.address);
            const receipt = await tx.wait();
            
            const transferEvent = receipt.events?.find(e => e.event === 'OwnershipTransferred');
            expect(transferEvent).to.exist;
            expect(transferEvent.args.noteId.toString()).to.equal("1");
            expect(transferEvent.args.previousOwner).to.equal(user1.address);
            expect(transferEvent.args.newOwner).to.equal(user2.address);
            
            // Verify ownership changed
            const isUser1Owner = await noteRegistry.isNoteOwner(1, user1.address);
            const isUser2Owner = await noteRegistry.isNoteOwner(1, user2.address);
            expect(isUser1Owner).to.be.false;
            expect(isUser2Owner).to.be.true;
            
            // Verify note counts updated
            const user1Count = await noteRegistry.getOwnerNoteCount(user1.address);
            const user2Count = await noteRegistry.getOwnerNoteCount(user2.address);
            expect(user1Count.toString()).to.equal("0");
            expect(user2Count.toString()).to.equal("1");
        });

        it("Should reject transfer from non-owner", async function () {
            try {
                await noteRegistry.connect(user2).transferNoteOwnership(1, user2.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Only the owner can transfer this note");
            }
        });

        it("Should reject transfer to zero address", async function () {
            try {
                await noteRegistry.connect(user1).transferNoteOwnership(1, ethers.constants.AddressZero);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Cannot transfer to zero address");
            }
        });

        it("Should reject transfer to self", async function () {
            try {
                await noteRegistry.connect(user1).transferNoteOwnership(1, user1.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Cannot transfer to self");
            }
        });

        it("Should reject transfer of non-existent note", async function () {
            try {
                await noteRegistry.connect(user1).transferNoteOwnership(999, user2.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
        });

        it("Should handle transfer of deactivated note", async function () {
            await noteRegistry.connect(user1).deactivateNote(1);
            
            // Transfer should still work for deactivated notes
            await noteRegistry.connect(user1).transferNoteOwnership(1, user2.address);
            
            const isUser2Owner = await noteRegistry.isNoteOwner(1, user2.address);
            expect(isUser2Owner).to.be.true;
        });
    });

    describe("Query Functions - Branch Coverage", function () {
        beforeEach(async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            await noteRegistry.connect(user1).registerNote(sampleHash2, sampleTitle2);
            await noteRegistry.connect(user2).registerNote("0x4444444444444444444444444444444444444444444444444444444444444444", "User2 Note");
        });

        it("Should return correct owner notes", async function () {
            const user1Notes = await noteRegistry.getOwnerNotes(user1.address);
            expect(user1Notes.length).to.equal(2);
            expect(user1Notes[0].toString()).to.equal("1");
            expect(user1Notes[1].toString()).to.equal("2");
            
            const user2Notes = await noteRegistry.getOwnerNotes(user2.address);
            expect(user2Notes.length).to.equal(1);
            expect(user2Notes[0].toString()).to.equal("3");
        });

        it("Should return correct active note count", async function () {
            const activeCount = await noteRegistry.getActiveNoteCount();
            expect(activeCount.toString()).to.equal("3");
            
            // Deactivate one note
            await noteRegistry.connect(user1).deactivateNote(1);
            
            const newActiveCount = await noteRegistry.getActiveNoteCount();
            expect(newActiveCount.toString()).to.equal("2");
        });

        it("Should get note by hash", async function () {
            const noteData = await noteRegistry.getNote(sampleHash);
            expect(noteData.exists).to.be.true;
            expect(noteData.owner).to.equal(user1.address);
            expect(noteData.title).to.equal(sampleTitle);
            expect(noteData.isActive).to.be.true;
        });

        it("Should check note ownership correctly", async function () {
            const isOwner1 = await noteRegistry.isOwner(1);
            expect(isOwner1).to.be.false; // Called by test contract, not user1
            
            const isOwnerUser1 = await noteRegistry.connect(user1).isOwner(1);
            expect(isOwnerUser1).to.be.true;
        });

        it("Should return correct total note count", async function () {
            const totalCount = await noteRegistry.totalNotes();
            expect(totalCount.toString()).to.equal("3");
            
            // Total count should not decrease when notes are deactivated
            await noteRegistry.connect(user1).deactivateNote(1);
            const totalCountAfter = await noteRegistry.totalNotes();
            expect(totalCountAfter.toString()).to.equal("3");
        });

        it("Should handle empty owner note lists", async function () {
            const emptyUserNotes = await noteRegistry.getOwnerNotes(ethers.constants.AddressZero);
            expect(emptyUserNotes.length).to.equal(0);
            
            const emptyCount = await noteRegistry.getOwnerNoteCount(ethers.constants.AddressZero);
            expect(emptyCount.toString()).to.equal("0");
        });

        it("Should handle non-existent note queries", async function () {
            const nonExistentHash = "0x9999999999999999999999999999999999999999999999999999999999999999";
            const noteData = await noteRegistry.getNote(nonExistentHash);
            expect(noteData.exists).to.be.false;
            expect(noteData.owner).to.equal(ethers.constants.AddressZero);
            expect(noteData.title).to.equal("");
            expect(noteData.isActive).to.be.false;
        });
    });

    describe("Edge Cases and Error Handling", function () {
        it("Should reject operations on non-existent notes", async function () {
            try {
                await noteRegistry.connect(user1).updateNoteHash(999, sampleHash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
        });

        it("Should handle boundary note IDs", async function () {
            // Register a note to get ID 1
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            
            // Try to access note 0 (should not exist)
            try {
                await noteRegistry.isOwner(0);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
        });

        it("Should handle maximum title length", async function () {
            const longTitle = "A".repeat(1000); // Very long title
            await noteRegistry.connect(user1).registerNote(sampleHash, longTitle);
            
            const noteData = await noteRegistry.getNote(sampleHash);
            expect(noteData.title).to.equal(longTitle);
        });

        it("Should maintain consistency after multiple operations", async function () {
            // Register multiple notes
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            await noteRegistry.connect(user2).registerNote(sampleHash2, sampleTitle2);
            
            // Transfer one
            await noteRegistry.connect(user1).transferNoteOwnership(1, user2.address);
            
            // Deactivate one
            await noteRegistry.connect(user2).deactivateNote(2);
            
            // Verify final state
            const totalNotes = await noteRegistry.totalNotes();
            const activeNotes = await noteRegistry.getActiveNoteCount();
            const user1Notes = await noteRegistry.getOwnerNoteCount(user1.address);
            const user2Notes = await noteRegistry.getOwnerNoteCount(user2.address);
            
            expect(totalNotes.toString()).to.equal("2");
            expect(activeNotes.toString()).to.equal("1"); // One deactivated
            expect(user1Notes.toString()).to.equal("0"); // Transferred away
            expect(user2Notes.toString()).to.equal("2"); // Received one + original
        });
    });
});
