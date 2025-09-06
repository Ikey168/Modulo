// Enhanced Smart Contract Branch Coverage Tests
// This file provides comprehensive branch coverage improvements

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Branch Coverage Enhancement Suite", function () {
    let noteRegistry;
    let moduloToken;
    let noteMonetization;
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
        
        const NoteMonetization = await ethers.getContractFactory("NoteMonetization");
        noteMonetization = await NoteMonetization.deploy(moduloToken.address);
        await noteMonetization.deployed();
    });

    describe("🎯 Critical Branch Coverage Tests", function () {
        
        describe("NoteRegistry Branch Coverage", function () {
            it("Should test all registration validation branches", async function () {
                const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test1"));
                const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test2"));
                
                // Test successful registration
                await noteRegistry.registerNote(hash1, "Test Note 1");
                expect(await noteRegistry.noteCount()).to.equal(1);
                
                // Test different users can register different notes
                await noteRegistry.connect(user1).registerNote(hash2, "Test Note 2");
                expect(await noteRegistry.noteCount()).to.equal(2);
                
                // Test ownership verification
                expect(await noteRegistry.noteOwners(hash1)).to.equal(owner.address);
                expect(await noteRegistry.noteOwners(hash2)).to.equal(user1.address);
                
                // Test verification function branches
                const [exists1, isOwner1, isActive1] = await noteRegistry.verifyNote(hash1);
                expect(exists1).to.be.true;
                expect(isOwner1).to.be.true;
                expect(isActive1).to.be.true;
                
                const [exists2, isOwner2, isActive2] = await noteRegistry.connect(user1).verifyNote(hash1);
                expect(exists2).to.be.true;
                expect(isOwner2).to.be.false; // user1 is not owner of hash1
                expect(isActive2).to.be.true;
                
                // Test non-existent note
                const fakeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fake"));
                const [exists3, isOwner3, isActive3] = await noteRegistry.verifyNote(fakeHash);
                expect(exists3).to.be.false;
                expect(isOwner3).to.be.false;
                expect(isActive3).to.be.false;
            });
            
            it("Should test deactivation branches", async function () {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("deactivation-test"));
                
                await noteRegistry.registerNote(hash, "Deactivation Test");
                expect(await noteRegistry.activeNotes(hash)).to.be.true;
                
                // Test successful deactivation
                await noteRegistry.deactivateNote(hash);
                expect(await noteRegistry.activeNotes(hash)).to.be.false;
                
                // Test that verification returns correct values for deactivated note
                const [exists, isOwner, isActive] = await noteRegistry.verifyNote(hash);
                expect(exists).to.be.true;
                expect(isOwner).to.be.true;
                expect(isActive).to.be.false;
            });
            
            it("Should test ownership transfer branches", async function () {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("transfer-test"));
                
                await noteRegistry.registerNote(hash, "Transfer Test");
                expect(await noteRegistry.noteOwners(hash)).to.equal(owner.address);
                
                // Test successful ownership transfer
                await noteRegistry.transferOwnership(hash, user1.address);
                expect(await noteRegistry.noteOwners(hash)).to.equal(user1.address);
                
                // Test that new owner can verify note
                const [exists, isOwner, isActive] = await noteRegistry.connect(user1).verifyNote(hash);
                expect(exists).to.be.true;
                expect(isOwner).to.be.true;
                expect(isActive).to.be.true;
                
                // Test that old owner is no longer owner
                const [, oldIsOwner] = await noteRegistry.verifyNote(hash);
                expect(oldIsOwner).to.be.false;
            });
        });
        
        describe("ModuloToken Branch Coverage", function () {
            it("Should test minting authorization branches", async function () {
                // Test that owner is initially a minter
                expect(await moduloToken.minters(owner.address)).to.be.true;
                expect(await moduloToken.minters(user1.address)).to.be.false;
                
                // Test adding minter
                await moduloToken.addMinter(user1.address);
                expect(await moduloToken.minters(user1.address)).to.be.true;
                
                // Test minting by authorized minter
                const mintAmount = ethers.utils.parseEther("100");
                await moduloToken.connect(user1).mint(user2.address, mintAmount);
                expect(await moduloToken.balanceOf(user2.address)).to.equal(mintAmount);
                
                // Test removing minter
                await moduloToken.removeMinter(user1.address);
                expect(await moduloToken.minters(user1.address)).to.be.false;
            });
            
            it("Should test pause functionality branches", async function () {
                const transferAmount = ethers.utils.parseEther("50");
                
                // Test normal transfer works
                await moduloToken.transfer(user1.address, transferAmount);
                expect(await moduloToken.balanceOf(user1.address)).to.equal(transferAmount);
                
                // Test pause
                await moduloToken.pause();
                expect(await moduloToken.paused()).to.be.true;
                
                // Test unpause
                await moduloToken.unpause();
                expect(await moduloToken.paused()).to.be.false;
                
                // Test transfer works again after unpause
                await moduloToken.connect(user1).transfer(user2.address, transferAmount);
                expect(await moduloToken.balanceOf(user2.address)).to.equal(transferAmount);
            });
            
            it("Should test burning branches", async function () {
                const initialAmount = ethers.utils.parseEther("1000");
                const burnAmount = ethers.utils.parseEther("100");
                
                // Give user1 some tokens to burn
                await moduloToken.transfer(user1.address, initialAmount);
                expect(await moduloToken.balanceOf(user1.address)).to.equal(initialAmount);
                
                // Test burning own tokens
                await moduloToken.connect(user1).burn(burnAmount);
                expect(await moduloToken.balanceOf(user1.address)).to.equal(initialAmount.sub(burnAmount));
                
                // Test burning with approval
                const burnAmount2 = ethers.utils.parseEther("50");
                await moduloToken.connect(user1).approve(user2.address, burnAmount2);
                await moduloToken.connect(user2).burnFrom(user1.address, burnAmount2);
                expect(await moduloToken.balanceOf(user1.address)).to.equal(initialAmount.sub(burnAmount).sub(burnAmount2));
            });
        });
        
        describe("NoteMonetization Branch Coverage", function () {
            it("Should test note pricing branches", async function () {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pricing-test"));
                const price = ethers.utils.parseEther("1");
                
                // Register a premium note
                await noteMonetization.registerNote(hash, "Premium Note", price);
                
                // Test price retrieval
                const noteInfo = await noteMonetization.notes(hash);
                expect(noteInfo.price).to.equal(price);
                expect(noteInfo.isPremium).to.be.true;
                
                // Test free vs premium access branches
                expect(await noteMonetization.hasAccess(hash, owner.address)).to.be.true; // Owner always has access
                expect(await noteMonetization.hasAccess(hash, user1.address)).to.be.false; // User doesn't have access yet
                
                // Test price update branches
                const newPrice = ethers.utils.parseEther("2");
                await noteMonetization.updateNotePrice(hash, newPrice);
                const updatedNote = await noteMonetization.notes(hash);
                expect(updatedNote.price).to.equal(newPrice);
                
                // Test converting premium to free
                await noteMonetization.updateNotePrice(hash, 0);
                const freeNote = await noteMonetization.notes(hash);
                expect(freeNote.price).to.equal(0);
                expect(freeNote.isPremium).to.be.false;
                
                // Now anyone should have access
                expect(await noteMonetization.hasAccess(hash, user1.address)).to.be.true;
            });
            
            it("Should test platform fee branches", async function () {
                const initialFee = await noteMonetization.platformFee();
                expect(initialFee).to.equal(250); // 2.5%
                
                // Test fee update
                const newFee = 500; // 5%
                await noteMonetization.updatePlatformFee(newFee);
                expect(await noteMonetization.platformFee()).to.equal(newFee);
                
                // Test fee recipient update
                await noteMonetization.updateFeeRecipient(user1.address);
                expect(await noteMonetization.feeRecipient()).to.equal(user1.address);
            });
            
            it("Should test pause functionality branches", async function () {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pause-test"));
                
                // Test normal operation
                await noteMonetization.registerNote(hash, "Pause Test", 0);
                expect(await noteMonetization.hasAccess(hash, owner.address)).to.be.true;
                
                // Test pause
                await noteMonetization.pause();
                expect(await noteMonetization.paused()).to.be.true;
                
                // Test unpause
                await noteMonetization.unpause();
                expect(await noteMonetization.paused()).to.be.false;
            });
        });
    });

    describe("📊 Edge Case Branch Coverage", function () {
        it("Should test boundary conditions", async function () {
            // Test with maximum uint256 values where safe
            const maxHash = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
            
            // Test empty vs non-empty string branches
            const emptyString = "";
            const normalString = "Normal Title";
            const longString = "A".repeat(1000);
            
            // Test registration with different title lengths
            const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("title-test-1"));
            const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("title-test-2"));
            const hash3 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("title-test-3"));
            
            await noteRegistry.registerNote(hash1, normalString);
            await noteRegistry.registerNote(hash2, longString);
            
            expect(await noteRegistry.noteCount()).to.equal(2);
        });
        
        it("Should test error condition branches", async function () {
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("error-test"));
            
            // Test operations on non-existent notes
            try {
                await noteRegistry.deactivateNote(hash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            try {
                await noteRegistry.transferOwnership(hash, user1.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Note does not exist");
            }
            
            // Register note and test owner-only operations
            await noteRegistry.registerNote(hash, "Error Test");
            
            // Test non-owner operations
            try {
                await noteRegistry.connect(user1).deactivateNote(hash);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Only the owner");
            }
            
            try {
                await noteRegistry.connect(user1).transferOwnership(hash, user2.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Only the owner");
            }
        });
    });

    describe("🔄 State Transition Branch Coverage", function () {
        it("Should test complex state transitions", async function () {
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("state-test"));
            
            // Initial state: not registered
            const [exists1] = await noteRegistry.verifyNote(hash);
            expect(exists1).to.be.false;
            
            // State 1: registered and active
            await noteRegistry.registerNote(hash, "State Test");
            const [exists2, isOwner2, isActive2] = await noteRegistry.verifyNote(hash);
            expect(exists2).to.be.true;
            expect(isOwner2).to.be.true;
            expect(isActive2).to.be.true;
            
            // State 2: registered but inactive
            await noteRegistry.deactivateNote(hash);
            const [exists3, isOwner3, isActive3] = await noteRegistry.verifyNote(hash);
            expect(exists3).to.be.true;
            expect(isOwner3).to.be.true;
            expect(isActive3).to.be.false;
            
            // State 3: transferred ownership (still inactive)
            // Note: Cannot transfer inactive notes, so this will fail as expected
            try {
                await noteRegistry.transferOwnership(hash, user1.address);
                expect.fail("Should not allow transfer of inactive note");
            } catch (error) {
                expect(error.message).to.include("Note is not active");
            }
        });
        
        it("Should test monetization state transitions", async function () {
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("monetization-state"));
            
            // State 1: Free note
            await noteMonetization.registerNote(hash, "Monetization Test", 0);
            expect(await noteMonetization.hasAccess(hash, user1.address)).to.be.true;
            
            // State 2: Premium note
            const price = ethers.utils.parseEther("1");
            await noteMonetization.updateNotePrice(hash, price);
            expect(await noteMonetization.hasAccess(hash, user1.address)).to.be.false;
            expect(await noteMonetization.hasAccess(hash, owner.address)).to.be.true; // Owner always has access
            
            // State 3: Back to free
            await noteMonetization.updateNotePrice(hash, 0);
            expect(await noteMonetization.hasAccess(hash, user1.address)).to.be.true;
        });
    });
});
