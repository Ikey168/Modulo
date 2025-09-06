const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🎯 Complete Branch Coverage Tests", function () {
    let noteRegistry, moduloToken;
    let owner, user1, user2, user3;
    
    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy contracts
        const NoteRegistry = await ethers.getContractFactory("NoteRegistry");
        noteRegistry = await NoteRegistry.deploy();
        await noteRegistry.deployed();
        
        const ModuloToken = await ethers.getContractFactory("ModuloToken");
        moduloToken = await ModuloToken.deploy();
        await moduloToken.deployed();
    });

    describe("🎯 NoteRegistry 100% Branch Coverage", function () {
        it("Should cover all edge cases in registration", async function () {
            const testHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("content1"));
            const testHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("content2"));
            const testTitle = "Test Note";
            
            // Test successful registration
            await noteRegistry.connect(user1).registerNote(testHash1, testTitle);
            
            // Test duplicate hash prevention
            try {
                await noteRegistry.connect(user2).registerNote(testHash1, "Different Title");
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note hash already exists");
            }
            
            // Test empty hash prevention
            try {
                await noteRegistry.connect(user1).registerNote("0x0000000000000000000000000000000000000000000000000000000000000000", testTitle);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Hash cannot be empty");
            }
            
            // Test empty title prevention
            try {
                await noteRegistry.connect(user1).registerNote(testHash2, "");
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Title cannot be empty");
            }
        });

        it("Should cover all verification branches", async function () {
            const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("verify content"));
            const testTitle = "Verify Test";
            
            // Register note for verification tests
            await noteRegistry.connect(user1).registerNote(testHash, testTitle);
            
            // Test owner verification
            const [exists1, isOwner1, isActive1] = await noteRegistry.connect(user1).verifyNote(testHash);
            expect(exists1).to.be.true;
            expect(isOwner1).to.be.true;
            expect(isActive1).to.be.true;
            
            // Test non-owner verification
            const [exists2, isOwner2, isActive2] = await noteRegistry.connect(user2).verifyNote(testHash);
            expect(exists2).to.be.true;
            expect(isOwner2).to.be.false;
            expect(isActive2).to.be.true;
            
            // Test non-existent note verification
            const nonExistentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("non existent"));
            const [exists3, isOwner3, isActive3] = await noteRegistry.connect(user1).verifyNote(nonExistentHash);
            expect(exists3).to.be.false;
            expect(isOwner3).to.be.false;
            expect(isActive3).to.be.false;
        });

        it("Should cover all update branches", async function () {
            const testHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("update content 1"));
            const testHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("update content 2"));
            const testHash3 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("update content 3"));
            const testTitle = "Update Test";
            
            // Register initial notes
            await noteRegistry.connect(user1).registerNote(testHash1, testTitle);
            await noteRegistry.connect(user2).registerNote(testHash2, "Another Note");
            
            // Test successful update
            await noteRegistry.connect(user1).updateNote(1, testHash3);
            
            // Test non-owner update rejection
            try {
                await noteRegistry.connect(user2).updateNote(1, testHash2);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Not the owner of this note");
            }
            
            // Test duplicate hash update rejection
            try {
                await noteRegistry.connect(user1).updateNote(1, testHash2);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note hash already exists");
            }
            
            // Test empty hash update rejection
            try {
                await noteRegistry.connect(user1).updateNote(1, "0x0000000000000000000000000000000000000000000000000000000000000000");
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Hash cannot be empty");
            }
        });

        it("Should cover all deactivation branches", async function () {
            const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("deactivate content"));
            const testTitle = "Deactivate Test";
            
            // Register note for deactivation tests
            await noteRegistry.connect(user1).registerNote(testHash, testTitle);
            
            // Test non-owner deactivation rejection
            try {
                await noteRegistry.connect(user2).deactivateNote(1);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Not the owner of this note");
            }
            
            // Test successful deactivation
            await noteRegistry.connect(user1).deactivateNote(1);
            
            // Test operations on deactivated note
            try {
                await noteRegistry.connect(user1).updateNote(1, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new content")));
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note is not active");
            }
        });

        it("Should cover all ownership transfer branches", async function () {
            const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("transfer content"));
            const testTitle = "Transfer Test";
            
            // Register note for transfer tests
            await noteRegistry.connect(user1).registerNote(testHash, testTitle);
            
            // Test non-owner transfer rejection
            try {
                await noteRegistry.connect(user2).transferOwnership(1, user3.address);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Not the owner of this note");
            }
            
            // Test zero address transfer rejection
            try {
                await noteRegistry.connect(user1).transferOwnership(1, ethers.constants.AddressZero);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Cannot transfer to zero address");
            }
            
            // Test self transfer rejection
            try {
                await noteRegistry.connect(user1).transferOwnership(1, user1.address);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Cannot transfer to yourself");
            }
            
            // Test successful transfer
            await noteRegistry.connect(user1).transferOwnership(1, user2.address);
            
            // Test that ownership was transferred
            expect(await noteRegistry.isNoteOwner(1, user2.address)).to.be.true;
            expect(await noteRegistry.isNoteOwner(1, user1.address)).to.be.false;
        });

        it("Should cover all query function branches", async function () {
            const testHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("query content 1"));
            const testHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("query content 2"));
            const testTitle = "Query Test";
            
            // Register multiple notes
            await noteRegistry.connect(user1).registerNote(testHash1, testTitle);
            await noteRegistry.connect(user1).registerNote(testHash2, testTitle);
            await noteRegistry.connect(user2).registerNote(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("other content")), "Other");
            
            // Deactivate one note
            await noteRegistry.connect(user1).deactivateNote(2);
            
            // Test owner notes query
            const user1Notes = await noteRegistry.getNotesByOwner(user1.address);
            expect(user1Notes.length).to.equal(2);
            expect(user1Notes[0].toNumber()).to.equal(1);
            expect(user1Notes[1].toNumber()).to.equal(2);
            
            // Test active note count
            expect((await noteRegistry.getActiveNoteCount(user1.address)).toNumber()).to.equal(1);
            expect((await noteRegistry.getActiveNoteCount(user2.address)).toNumber()).to.equal(1);
            
            // Test total note count
            expect((await noteRegistry.getTotalNoteCount()).toNumber()).to.equal(3);
            
            // Test note by hash
            const note = await noteRegistry.getNoteByHash(testHash1);
            expect(note.owner).to.equal(user1.address);
            expect(note.hash).to.equal(testHash1);
            
            // Test ownership check
            expect(await noteRegistry.isNoteOwner(1, user1.address)).to.be.true;
            expect(await noteRegistry.isNoteOwner(1, user2.address)).to.be.false;
        });

        it("Should cover all edge cases and error conditions", async function () {
            // Test operations on non-existent notes
            try {
                await noteRegistry.getNote(999);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            try {
                await noteRegistry.updateNote(999, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test")));
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            try {
                await noteRegistry.deactivateNote(999);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            try {
                await noteRegistry.transferOwnership(999, user1.address);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            // Test empty owner note lists
            const emptyNotes = await noteRegistry.getNotesByOwner(user3.address);
            expect(emptyNotes.length).to.equal(0);
            
            expect((await noteRegistry.getActiveNoteCount(user3.address)).toNumber()).to.equal(0);
        });
    });

    describe("🎯 ModuloToken 100% Branch Coverage", function () {
        it("Should cover all minting authorization branches", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            
            // Test owner can mint initially
            await moduloToken.mint(user1.address, mintAmount);
            expect((await moduloToken.balanceOf(user1.address)).toString()).to.equal(mintAmount.toString());
            
            // Test non-minter cannot mint
            try {
                await moduloToken.connect(user1).mint(user2.address, mintAmount);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Not authorized to mint");
            }
            
            // Test adding and removing minters
            await moduloToken.addMinter(user1.address);
            expect(await moduloToken.minters(user1.address)).to.be.true;
            
            await moduloToken.connect(user1).mint(user2.address, mintAmount);
            expect((await moduloToken.balanceOf(user2.address)).toString()).to.equal(mintAmount.toString());
            
            await moduloToken.removeMinter(user1.address);
            expect(await moduloToken.minters(user1.address)).to.be.false;
        });

        it("Should cover all supply limit branches", async function () {
            const maxSupply = await moduloToken.maxSupply();
            const totalSupply = await moduloToken.totalSupply();
            const availableToMint = maxSupply.sub(totalSupply);
            
            // Test minting within limits
            if (availableToMint.gt(0)) {
                const safeAmount = availableToMint.div(2);
                await moduloToken.mint(user1.address, safeAmount);
                expect((await moduloToken.balanceOf(user1.address)).gte(safeAmount)).to.be.true;
            }
            
            // Test exceeding max supply
            const excessAmount = maxSupply.add(1);
            try {
                await moduloToken.mint(user2.address, excessAmount);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Exceeds maximum supply");
            }
        });

        it("Should cover all pause functionality branches", async function () {
            const transferAmount = ethers.utils.parseEther("100");
            
            // Ensure user has tokens to transfer
            await moduloToken.transfer(user1.address, transferAmount);
            
            // Test pausing
            await moduloToken.pause();
            expect(await moduloToken.paused()).to.be.true;
            
            // Test transfers blocked when paused
            try {
                await moduloToken.connect(user1).transfer(user2.address, transferAmount);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Pausable: paused");
            }
            
            // Test minting blocked when paused
            try {
                await moduloToken.mint(user2.address, transferAmount);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Pausable: paused");
            }
            
            // Test unpausing
            await moduloToken.unpause();
            expect(await moduloToken.paused()).to.be.false;
            
            // Test operations work after unpausing
            await moduloToken.connect(user1).transfer(user2.address, transferAmount);
            expect((await moduloToken.balanceOf(user2.address)).gte(transferAmount)).to.be.true;
        });

        it("Should cover all access control branches", async function () {
            // Test non-owner cannot add minters
            try {
                await moduloToken.connect(user1).addMinter(user2.address);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Ownable: caller is not the owner");
            }
            
            // Test non-owner cannot remove minters
            try {
                await moduloToken.connect(user1).removeMinter(owner.address);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Ownable: caller is not the owner");
            }
            
            // Test non-owner cannot pause
            try {
                await moduloToken.connect(user1).pause();
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Ownable: caller is not the owner");
            }
        });

        it("Should cover all burning branches", async function () {
            const burnAmount = ethers.utils.parseEther("100");
            
            // Transfer tokens to users for burning tests
            await moduloToken.transfer(user1.address, burnAmount.mul(2));
            await moduloToken.transfer(user2.address, burnAmount);
            
            // Test normal burning
            await moduloToken.connect(user1).burn(burnAmount);
            expect((await moduloToken.balanceOf(user1.address)).toString()).to.equal(burnAmount.toString());
            
            // Test burn with approval
            await moduloToken.connect(user1).approve(user2.address, burnAmount);
            await moduloToken.connect(user2).burnFrom(user1.address, burnAmount);
            expect((await moduloToken.balanceOf(user1.address)).toNumber()).to.equal(0);
            
            // Test burning more than balance should fail
            try {
                await moduloToken.connect(user1).burn(burnAmount);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("ERC20: burn amount exceeds balance");
            }
        });
    });
});
