const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NoteRegistry - Corrected Branch Coverage", function () {
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
            const totalNotes = await noteRegistry.getTotalNoteCount();
            expect(totalNotes.toString()).to.equal("0");
            
            const activeNotes = await noteRegistry.getActiveNoteCount(user1.address);
            expect(activeNotes.toString()).to.equal("0");
        });

        it("Should initialize with zero notes for any user", async function () {
            const user1Notes = await noteRegistry.getNotesByOwner(user1.address);
            const user2Notes = await noteRegistry.getNotesByOwner(user2.address);
            expect(user1Notes.length).to.equal(0);
            expect(user2Notes.length).to.equal(0);
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
            const userNotes = await noteRegistry.getNotesByOwner(user1.address);
            expect(userNotes.length).to.equal(1);
            expect(userNotes[0].toString()).to.equal("1");
            
            // Verify total notes increased
            const totalNotes = await noteRegistry.getTotalNoteCount();
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
                expect(error.message).to.include("already exists");
            }
        });

        it("Should allow different users to register different notes", async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            await noteRegistry.connect(user2).registerNote(sampleHash2, sampleTitle2);
            
            const totalNotes = await noteRegistry.getTotalNoteCount();
            expect(totalNotes.toString()).to.equal("2");
            
            const user1Notes = await noteRegistry.getNotesByOwner(user1.address);
            const user2Notes = await noteRegistry.getNotesByOwner(user2.address);
            expect(user1Notes.length).to.equal(1);
            expect(user2Notes.length).to.equal(1);
        });

        it("Should handle registration with same title but different hash", async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            await noteRegistry.connect(user2).registerNote(sampleHash2, sampleTitle); // Same title, different hash
            
            const totalNotes = await noteRegistry.getTotalNoteCount();
            expect(totalNotes.toString()).to.equal("2");
        });

        it("Should handle maximum hash value", async function () {
            const maxHash = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
            await noteRegistry.connect(user1).registerNote(maxHash, sampleTitle);
            
            const userNotes = await noteRegistry.getNotesByOwner(user1.address);
            expect(userNotes.length).to.equal(1);
        });
    });

    describe("Note Verification - Branch Coverage", function () {
        beforeEach(async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
        });

        it("Should verify existing note correctly", async function () {
            const result = await noteRegistry.verifyNote(sampleHash);
            expect(result.exists).to.be.true;
            expect(result.isActive).to.be.true;
        });

        it("Should verify note ownership correctly", async function () {
            const isOwner = await noteRegistry.isNoteOwner(1, user1.address);
            expect(isOwner).to.be.true;
            
            const isNotOwner = await noteRegistry.isNoteOwner(1, user2.address);
            expect(isNotOwner).to.be.false;
        });

        it("Should return false for non-existent note", async function () {
            const nonExistentHash = "0x9999999999999999999999999999999999999999999999999999999999999999";
            const result = await noteRegistry.verifyNote(nonExistentHash);
            expect(result.exists).to.be.false;
            expect(result.isOwner).to.be.false;
            expect(result.isActive).to.be.false;
        });

        it("Should handle zero address in ownership check", async function () {
            const isOwner = await noteRegistry.isNoteOwner(1, ethers.constants.AddressZero);
            expect(isOwner).to.be.false;
        });

        it("Should return note by hash correctly", async function () {
            const noteData = await noteRegistry.getNoteByHash(sampleHash);
            expect(noteData.owner).to.equal(user1.address);
            expect(noteData.title).to.equal(sampleTitle);
            expect(noteData.isActive).to.be.true;
        });
    });

    describe("Note Updates - Enhanced Branch Coverage", function () {
        beforeEach(async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
        });

        it("Should update note hash successfully", async function () {
            const newHash = "0x3333333333333333333333333333333333333333333333333333333333333333";
            
            const tx = await noteRegistry.connect(user1).updateNote(1, newHash);
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
                await noteRegistry.connect(user2).updateNote(1, newHash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Only the owner");
            }
        });

        it("Should reject update to existing hash", async function () {
            // Register another note first
            await noteRegistry.connect(user2).registerNote(sampleHash2, sampleTitle2);
            
            try {
                await noteRegistry.connect(user1).updateNote(1, sampleHash2);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("already exists");
            }
        });

        it("Should reject update to empty hash", async function () {
            try {
                await noteRegistry.connect(user1).updateNote(1, "0x0000000000000000000000000000000000000000000000000000000000000000");
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Hash cannot be empty");
            }
        });

        it("Should reject update of non-existent note", async function () {
            const newHash = "0x3333333333333333333333333333333333333333333333333333333333333333";
            
            try {
                await noteRegistry.connect(user1).updateNote(999, newHash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
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
            const activeCount = await noteRegistry.getActiveNoteCount(user1.address);
            expect(activeCount.toString()).to.equal("0");
        });

        it("Should reject deactivation from non-owner", async function () {
            try {
                await noteRegistry.connect(user2).deactivateNote(1);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Only the owner");
            }
        });

        it("Should reject operations on deactivated note", async function () {
            await noteRegistry.connect(user1).deactivateNote(1);
            
            const newHash = "0x3333333333333333333333333333333333333333333333333333333333333333";
            try {
                await noteRegistry.connect(user1).updateNote(1, newHash);
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

        it("Should reject multiple deactivations", async function () {
            await noteRegistry.connect(user1).deactivateNote(1);
            
            try {
                await noteRegistry.connect(user1).deactivateNote(1);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note is not active");
            }
        });
    });

    describe("Ownership Transfer - Enhanced Coverage", function () {
        beforeEach(async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
        });

        it("Should transfer ownership successfully", async function () {
            const tx = await noteRegistry.connect(user1).transferOwnership(1, user2.address);
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
            const user1Notes = await noteRegistry.getNotesByOwner(user1.address);
            const user2Notes = await noteRegistry.getNotesByOwner(user2.address);
            expect(user1Notes.length).to.equal(0);
            expect(user2Notes.length).to.equal(1);
        });

        it("Should reject transfer from non-owner", async function () {
            try {
                await noteRegistry.connect(user2).transferOwnership(1, user2.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Only the owner");
            }
        });

        it("Should reject transfer to zero address", async function () {
            try {
                await noteRegistry.connect(user1).transferOwnership(1, ethers.constants.AddressZero);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Invalid new owner");
            }
        });

        it("Should reject transfer to self", async function () {
            try {
                await noteRegistry.connect(user1).transferOwnership(1, user1.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Cannot transfer to self");
            }
        });

        it("Should reject transfer of non-existent note", async function () {
            try {
                await noteRegistry.connect(user1).transferOwnership(999, user2.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
        });

        it("Should handle transfer of deactivated note", async function () {
            await noteRegistry.connect(user1).deactivateNote(1);
            
            // Transfer should still work for deactivated notes
            await noteRegistry.connect(user1).transferOwnership(1, user2.address);
            
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
            const user1Notes = await noteRegistry.getNotesByOwner(user1.address);
            expect(user1Notes.length).to.equal(2);
            expect(user1Notes[0].toString()).to.equal("1");
            expect(user1Notes[1].toString()).to.equal("2");
            
            const user2Notes = await noteRegistry.getNotesByOwner(user2.address);
            expect(user2Notes.length).to.equal(1);
            expect(user2Notes[0].toString()).to.equal("3");
        });

        it("Should return correct active note count", async function () {
            const user1ActiveCount = await noteRegistry.getActiveNoteCount(user1.address);
            expect(user1ActiveCount.toString()).to.equal("2");
            
            const user2ActiveCount = await noteRegistry.getActiveNoteCount(user2.address);
            expect(user2ActiveCount.toString()).to.equal("1");
            
            // Deactivate one note
            await noteRegistry.connect(user1).deactivateNote(1);
            
            const newUser1ActiveCount = await noteRegistry.getActiveNoteCount(user1.address);
            expect(newUser1ActiveCount.toString()).to.equal("1");
        });

        it("Should get note by ID", async function () {
            const noteData = await noteRegistry.getNote(1);
            expect(noteData.owner).to.equal(user1.address);
            expect(noteData.title).to.equal(sampleTitle);
            expect(noteData.isActive).to.be.true;
        });

        it("Should check note ownership correctly", async function () {
            const isOwnerUser1 = await noteRegistry.connect(user1).isOwner(1);
            expect(isOwnerUser1).to.be.true;
            
            const isOwnerUser2 = await noteRegistry.connect(user2).isOwner(1);
            expect(isOwnerUser2).to.be.false;
        });

        it("Should return correct total note count", async function () {
            const totalCount = await noteRegistry.getTotalNoteCount();
            expect(totalCount.toString()).to.equal("3");
            
            // Total count should not decrease when notes are deactivated
            await noteRegistry.connect(user1).deactivateNote(1);
            const totalCountAfter = await noteRegistry.getTotalNoteCount();
            expect(totalCountAfter.toString()).to.equal("3");
        });

        it("Should handle empty owner note lists", async function () {
            const emptyUserNotes = await noteRegistry.getNotesByOwner(ethers.constants.AddressZero);
            expect(emptyUserNotes.length).to.equal(0);
            
            const emptyCount = await noteRegistry.getActiveNoteCount(ethers.constants.AddressZero);
            expect(emptyCount.toString()).to.equal("0");
        });

        it("Should handle non-existent note queries gracefully", async function () {
            const nonExistentHash = "0x9999999999999999999999999999999999999999999999999999999999999999";
            const noteData = await noteRegistry.getNoteByHash(nonExistentHash);
            // Contract might return empty note or throw - handle both cases
            if (noteData.owner) {
                expect(noteData.owner).to.equal(ethers.constants.AddressZero);
            }
        });
    });

    describe("Edge Cases and Error Handling", function () {
        it("Should reject operations on non-existent notes", async function () {
            try {
                await noteRegistry.connect(user1).updateNote(999, sampleHash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
        });

        it("Should handle boundary note IDs", async function () {
            // Try to access note 0 (should not exist)
            try {
                await noteRegistry.getNote(0);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
        });

        it("Should handle maximum title length", async function () {
            const longTitle = "A".repeat(1000); // Very long title
            await noteRegistry.connect(user1).registerNote(sampleHash, longTitle);
            
            const noteData = await noteRegistry.getNote(1);
            expect(noteData.title).to.equal(longTitle);
        });

        it("Should maintain consistency after multiple operations", async function () {
            // Register multiple notes
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            await noteRegistry.connect(user2).registerNote(sampleHash2, sampleTitle2);
            
            // Transfer one
            await noteRegistry.connect(user1).transferOwnership(1, user2.address);
            
            // Deactivate one
            await noteRegistry.connect(user2).deactivateNote(2);
            
            // Verify final state
            const totalNotes = await noteRegistry.getTotalNoteCount();
            const user1ActiveNotes = await noteRegistry.getActiveNoteCount(user1.address);
            const user2ActiveNotes = await noteRegistry.getActiveNoteCount(user2.address);
            const user1Notes = await noteRegistry.getNotesByOwner(user1.address);
            const user2Notes = await noteRegistry.getNotesByOwner(user2.address);
            
            expect(totalNotes.toString()).to.equal("2");
            expect(user1ActiveNotes.toString()).to.equal("0"); // Transferred away
            expect(user2ActiveNotes.toString()).to.equal("1"); // One active (one deactivated)
            expect(user1Notes.length).to.equal(0); // Transferred away
            expect(user2Notes.length).to.equal(2); // Received one + original
        });
    });

    describe("Additional Branch Coverage Tests", function () {
        it("Should handle hash collision edge cases", async function () {
            await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            
            // Try to register the same hash from the same user
            try {
                await noteRegistry.connect(user1).registerNote(sampleHash, "Different Title");
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("already exists");
            }
        });

        it("Should handle sequential operations correctly", async function () {
            // Register -> Update -> Deactivate -> Transfer sequence
            const noteId = await noteRegistry.connect(user1).registerNote(sampleHash, sampleTitle);
            
            const newHash = "0x5555555555555555555555555555555555555555555555555555555555555555";
            await noteRegistry.connect(user1).updateNote(1, newHash);
            
            // Verify update worked
            const updatedResult = await noteRegistry.verifyNote(newHash);
            expect(updatedResult.exists).to.be.true;
            
            await noteRegistry.connect(user1).deactivateNote(1);
            
            // Should still be able to transfer deactivated note
            await noteRegistry.connect(user1).transferOwnership(1, user2.address);
            
            const isUser2Owner = await noteRegistry.isNoteOwner(1, user2.address);
            expect(isUser2Owner).to.be.true;
        });
        
        it("Should handle empty string edge cases", async function () {
            // Test with whitespace-only title
            try {
                await noteRegistry.connect(user1).registerNote(sampleHash, "   ");
                // If this succeeds, verify it's handled correctly
                const noteData = await noteRegistry.getNote(1);
                expect(noteData.title).to.equal("   ");
            } catch (error) {
                // If it fails, that's also valid behavior
                expect(error.message).to.include("Title cannot be empty");
            }
        });
    });
});
