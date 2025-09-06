const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🎯 Final 100% Branch Coverage Push", function () {
    let noteRegistry;
    let owner, addr1, addr2;
    
    const testHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test1"));
    const testHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test2"));
    const testTitle1 = "Test Title 1";

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        const NoteRegistry = await ethers.getContractFactory("NoteRegistry");
        noteRegistry = await NoteRegistry.deploy();
        await noteRegistry.deployed();
    });

    describe("🔥 Capture Final 2% Branch Coverage", function () {
        it("Should test all conditional paths in verifyNote", async function () {
            // Test with non-existent hash (noteId == 0 path)
            let result = await noteRegistry.verifyNote(testHash1);
            expect(result.exists).to.be.false;
            expect(result.isOwner).to.be.false;
            expect(result.isActive).to.be.false;
            
            // Register note and test all combinations
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            
            // Test exists=true, isOwner=true, isActive=true
            result = await noteRegistry.connect(addr1).verifyNote(testHash1);
            expect(result.exists).to.be.true;
            expect(result.isOwner).to.be.true;
            expect(result.isActive).to.be.true;
            
            // Test exists=true, isOwner=false, isActive=true
            result = await noteRegistry.connect(addr2).verifyNote(testHash1);
            expect(result.exists).to.be.true;
            expect(result.isOwner).to.be.false;
            expect(result.isActive).to.be.true;
            
            // Deactivate to test isActive=false path
            await noteRegistry.connect(addr1).deactivateNote(1);
            
            // After deactivation, hash mapping is deleted, so exists should be false
            result = await noteRegistry.connect(addr1).verifyNote(testHash1);
            expect(result.exists).to.be.false;
            expect(result.isOwner).to.be.false;
            expect(result.isActive).to.be.false;
        });

        it("Should test all branches in getActiveNoteCount", async function () {
            // Test with empty owner (count stays 0)
            let count = await noteRegistry.getActiveNoteCount(addr1.address);
            expect(count.toNumber()).to.equal(0);
            
            // Register multiple notes
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            await noteRegistry.connect(addr1).registerNote(testHash2, "Title 2");
            
            // Both active
            count = await noteRegistry.getActiveNoteCount(addr1.address);
            expect(count.toNumber()).to.equal(2);
            
            // Deactivate one to test mixed active/inactive
            await noteRegistry.connect(addr1).deactivateNote(1);
            count = await noteRegistry.getActiveNoteCount(addr1.address);
            expect(count.toNumber()).to.equal(1);
            
            // Deactivate all
            await noteRegistry.connect(addr1).deactivateNote(2);
            count = await noteRegistry.getActiveNoteCount(addr1.address);
            expect(count.toNumber()).to.equal(0);
        });

        it("Should test isNoteOwner function edge cases", async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            
            // Test true branch
            expect(await noteRegistry.isNoteOwner(1, addr1.address)).to.be.true;
            
            // Test false branch
            expect(await noteRegistry.isNoteOwner(1, addr2.address)).to.be.false;
            
            // Test with zero address
            expect(await noteRegistry.isNoteOwner(1, ethers.constants.AddressZero)).to.be.false;
        });

        it("Should test isOwner legacy function", async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            
            // Test true path
            expect(await noteRegistry.connect(addr1).isOwner(1)).to.be.true;
            
            // Test false path
            expect(await noteRegistry.connect(addr2).isOwner(1)).to.be.false;
            expect(await noteRegistry.connect(owner).isOwner(1)).to.be.false;
        });

        it("Should test edge cases in ownership transfer loop", async function () {
            // Create exactly 3 notes to test different loop positions
            const hash3 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test3"));
            const hash4 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test4"));
            
            await noteRegistry.connect(addr1).registerNote(testHash1, "Title 1");
            await noteRegistry.connect(addr1).registerNote(testHash2, "Title 2");
            await noteRegistry.connect(addr1).registerNote(hash3, "Title 3");
            
            // Test transferring first element (i=0)
            await noteRegistry.connect(addr1).transferOwnership(1, addr2.address);
            
            let addr1Notes = await noteRegistry.getNotesByOwner(addr1.address);
            expect(addr1Notes.length).to.equal(2);
            
            // Re-register more notes to test middle element transfer
            await noteRegistry.connect(addr1).registerNote(hash4, "Title 4");
            
            // Now transfer the middle note
            await noteRegistry.connect(addr1).transferOwnership(2, addr2.address);
            
            addr1Notes = await noteRegistry.getNotesByOwner(addr1.address);
            expect(addr1Notes.length).to.equal(2);
        });

        it("Should test boundary conditions in require statements", async function () {
            // Test noteExists modifier edge cases
            
            // Test with noteId = 0 (should fail)
            try {
                await noteRegistry.getNote(0);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            // Test with noteId = noteCount + 1 (should fail)
            const currentCount = await noteRegistry.getTotalNoteCount();
            try {
                await noteRegistry.getNote(currentCount.toNumber() + 1);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            // Register a note
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            
            // Test with valid noteId = noteCount (should pass)
            const newCount = await noteRegistry.getTotalNoteCount();
            const note = await noteRegistry.getNote(newCount.toNumber());
            expect(note.owner).to.equal(addr1.address);
        });

        it("Should test all possible hash collision scenarios", async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            
            // Test duplicate hash in registerNote
            try {
                await noteRegistry.connect(addr2).registerNote(testHash1, "Different Title");
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note hash already exists");
            }
            
            // Test duplicate hash in updateNote
            try {
                await noteRegistry.connect(addr1).updateNote(1, testHash1);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note hash already exists");
            }
            
            // Test updating to a different existing hash
            await noteRegistry.connect(addr2).registerNote(testHash2, "Title 2");
            try {
                await noteRegistry.connect(addr1).updateNote(1, testHash2);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note hash already exists");
            }
        });
    });
});
