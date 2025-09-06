const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🎯 Ultimate 100% Branch Coverage", function () {
    let noteRegistry, moduloToken;
    let owner, addr1, addr2, addr3;
    
    const testHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test1"));
    const testHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test2"));
    const testHash3 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test3"));
    const testHash4 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test4"));
    const testTitle1 = "Test Title 1";
    const testTitle2 = "Test Title 2";

    beforeEach(async function () {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        
        const NoteRegistry = await ethers.getContractFactory("NoteRegistry");
        noteRegistry = await NoteRegistry.deploy();
        await noteRegistry.deployed();
        
        const ModuloToken = await ethers.getContractFactory("ModuloToken");
        moduloToken = await ModuloToken.deploy();
        await moduloToken.deployed();
    });

    describe("🎯 NoteRegistry 100% Branch Coverage Tests", function () {
        it("Should achieve 100% branch coverage in ownership transfer loop", async function () {
            // Create multiple notes for addr1 to test all loop paths
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            await noteRegistry.connect(addr1).registerNote(testHash2, testTitle2);
            const testHash5 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test5"));
            await noteRegistry.connect(addr1).registerNote(testHash5, "Test Title 5");
            
            // Get notes before transfer
            let addr1Notes = await noteRegistry.getNotesByOwner(addr1.address);
            expect(addr1Notes.length).to.equal(3);
            
            // Transfer the middle note (noteId 2) to test loop logic
            await noteRegistry.connect(addr1).transferOwnership(2, addr2.address);
            
            // Verify the transfer worked and loop executed correctly
            const addr1NotesAfter = await noteRegistry.getNotesByOwner(addr1.address);
            const addr2NotesAfter = await noteRegistry.getNotesByOwner(addr2.address);
            
            expect(addr1NotesAfter.length).to.equal(2);
            expect(addr2NotesAfter.length).to.equal(1);
            expect(addr2NotesAfter[0].toNumber()).to.equal(2);
        });

        it("Should cover all conditional branches in verification functions", async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            
            // Test verifyNote function with all possible return combinations
            let result = await noteRegistry.connect(owner).verifyNote(testHash1);
            expect(result.exists).to.be.true;
            expect(result.isOwner).to.be.false; // Called by owner, but addr1 is the note owner
            expect(result.isActive).to.be.true;
            
            // Test with actual note owner
            result = await noteRegistry.connect(addr1).verifyNote(testHash1);
            expect(result.exists).to.be.true;
            expect(result.isOwner).to.be.true; // addr1 is the owner
            expect(result.isActive).to.be.true;
            
            // Deactivate and test again
            await noteRegistry.connect(addr1).deactivateNote(1);
            result = await noteRegistry.connect(addr1).verifyNote(testHash1);
            expect(result.exists).to.be.false; // Hash mapping deleted when deactivated
            expect(result.isOwner).to.be.false;
            expect(result.isActive).to.be.false;
        });

        it("Should test boundary conditions in loop structures", async function () {
            // Test ownership transfer with note at different positions in array
            
            // Single note - test removal when it's the only element
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            await noteRegistry.connect(addr1).transferOwnership(1, addr2.address);
            
            let addr1Notes = await noteRegistry.getNotesByOwner(addr1.address);
            expect(addr1Notes.length).to.equal(0);
            
            // Multiple notes - test removal from beginning
            const hash6 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test6"));
            const hash7 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test7"));
            const hash8 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test8"));
            
            await noteRegistry.connect(addr1).registerNote(hash6, "Title 6");
            await noteRegistry.connect(addr1).registerNote(hash7, "Title 7");
            await noteRegistry.connect(addr1).registerNote(hash8, "Title 8");
            
            // Transfer first note (should test i == 0 case)
            await noteRegistry.connect(addr1).transferOwnership(2, addr3.address);
            
            addr1Notes = await noteRegistry.getNotesByOwner(addr1.address);
            expect(addr1Notes.length).to.equal(2);
        });

        it("Should cover all edge cases in hash validation", async function () {
            // Test all possible require statement branches
            
            // Empty hash test
            try {
                await noteRegistry.connect(addr1).registerNote("0x0000000000000000000000000000000000000000000000000000000000000000", testTitle1);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Hash cannot be empty");
            }
            
            // Empty title test  
            try {
                await noteRegistry.connect(addr1).registerNote(testHash1, "");
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Title cannot be empty");
            }
            
            // Register valid note
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            
            // Duplicate hash test
            try {
                await noteRegistry.connect(addr2).registerNote(testHash1, testTitle2);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note hash already exists");
            }
        });

        it("Should test all modifier combinations and edge cases", async function () {
            await noteRegistry.connect(addr1).registerNote(testHash1, testTitle1);
            
            // Test noteExists modifier with invalid IDs
            try {
                await noteRegistry.getNote(0); // Test boundary condition
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            try {
                await noteRegistry.getNote(999); // Test upper boundary
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            // Test onlyOwner modifier
            try {
                await noteRegistry.connect(addr2).updateNote(1, testHash2);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Not the owner of this note");
            }
            
            // Test noteActive modifier
            await noteRegistry.connect(addr1).deactivateNote(1);
            try {
                await noteRegistry.connect(addr1).updateNote(1, testHash2);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note is not active");
            }
        });

        it("Should cover all loop termination conditions", async function () {
            // Test loop that exits via break vs natural termination
            const hash9 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test9"));
            const hash10 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test10"));
            
            await noteRegistry.connect(addr1).registerNote(hash9, "Title 9");
            await noteRegistry.connect(addr1).registerNote(hash10, "Title 10");
            
            // Transfer the last note (tests if loop goes to end)
            await noteRegistry.connect(addr1).transferOwnership(2, addr2.address);
            
            const addr1NotesAfter = await noteRegistry.getNotesByOwner(addr1.address);
            expect(addr1NotesAfter.length).to.equal(1);
            expect(addr1NotesAfter[0].toNumber()).to.equal(1);
        });
    });

    describe("🎯 ModuloToken Edge Case Coverage", function () {
        it("Should cover all conditional branches in supply checks", async function () {
            const maxSupply = await moduloToken.maxSupply();
            const currentSupply = await moduloToken.totalSupply();
            
            // Test minting exactly to max supply
            const remainingSupply = maxSupply.sub(currentSupply);
            if (remainingSupply.gt(0)) {
                await moduloToken.mint(addr1.address, remainingSupply);
                expect((await moduloToken.totalSupply()).toString()).to.equal(maxSupply.toString());
            }
            
            // Test minting beyond max supply
            try {
                await moduloToken.mint(addr1.address, 1);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Exceeds maximum supply");
            }
        });

        it("Should test all authorization branches", async function () {
            // Test minter authorization paths
            expect(await moduloToken.minters(owner.address)).to.be.true;
            expect(await moduloToken.minters(addr1.address)).to.be.false;
            
            // Add minter and test
            await moduloToken.addMinter(addr1.address);
            expect(await moduloToken.minters(addr1.address)).to.be.true;
            
            // Test minting by authorized minter
            const mintAmount = ethers.utils.parseEther("1000");
            const currentSupply = await moduloToken.totalSupply();
            const maxSupply = await moduloToken.maxSupply();
            
            if (currentSupply.add(mintAmount).lte(maxSupply)) {
                await moduloToken.connect(addr1).mint(addr2.address, mintAmount);
                expect((await moduloToken.balanceOf(addr2.address)).toString()).to.equal(mintAmount.toString());
            }
        });

        it("Should cover all pause functionality branches", async function () {
            // Test when not paused
            expect(await moduloToken.paused()).to.be.false;
            
            // Transfer some tokens for testing
            await moduloToken.transfer(addr1.address, ethers.utils.parseEther("100"));
            
            // Pause and test restrictions
            await moduloToken.pause();
            expect(await moduloToken.paused()).to.be.true;
            
            // Test transfer restriction when paused
            try {
                await moduloToken.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("10"));
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Pausable: paused");
            }
            
            // Test mint restriction when paused
            try {
                await moduloToken.mint(addr2.address, ethers.utils.parseEther("10"));
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Pausable: paused");
            }
            
            // Unpause and test functionality restoration
            await moduloToken.unpause();
            expect(await moduloToken.paused()).to.be.false;
        });
    });
});
