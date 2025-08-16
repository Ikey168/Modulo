const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NoteMonetization", function () {
    let ModuloToken;
    let moduloToken;
    let NoteMonetization;
    let noteMonetization;
    let owner;
    let user1;
    let user2;
    let user3;

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy ModuloToken first
        ModuloToken = await ethers.getContractFactory("ModuloToken");
        moduloToken = await ModuloToken.deploy();
        await moduloToken.deployed();
        
        // Deploy NoteMonetization
        NoteMonetization = await ethers.getContractFactory("NoteMonetization");
        noteMonetization = await NoteMonetization.deploy(moduloToken.address);
        await noteMonetization.deployed();
        
        // Transfer some tokens to test users
        await moduloToken.transfer(user1.address, ethers.utils.parseEther("1000"));
        await moduloToken.transfer(user2.address, ethers.utils.parseEther("1000"));
        await moduloToken.transfer(user3.address, ethers.utils.parseEther("1000"));
    });

    describe("Deployment", function () {
        it("Should set the correct ModuloToken address", async function () {
            expect(await noteMonetization.moduloToken()).to.equal(moduloToken.address);
        });

        it("Should set the owner as fee recipient", async function () {
            expect(await noteMonetization.feeRecipient()).to.equal(owner.address);
        });

        it("Should set correct initial platform fee", async function () {
            expect(await noteMonetization.platformFeePercent()).to.equal(250); // 2.5%
        });
    });

    describe("Note Registration", function () {
        it("Should register a free note successfully", async function () {
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test content"));
            
            await expect(
                noteMonetization.connect(user1).registerNote(
                    hash,
                    "Test Note",
                    false, // not premium
                    0,
                    "Education",
                    "A test note"
                )
            ).to.emit(noteMonetization, "NoteRegistered");
            
            expect(await noteMonetization.noteCount()).to.equal(1);
        });

        it("Should register a premium note successfully", async function () {
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("premium content"));
            const price = ethers.utils.parseEther("5");
            
            await expect(
                noteMonetization.connect(user1).registerNote(
                    hash,
                    "Premium Note",
                    true, // is premium
                    price,
                    "Advanced",
                    "A premium note"
                )
            ).to.emit(noteMonetization, "NoteRegistered");
            
            const noteDetails = await noteMonetization.getNoteDetails(1);
            expect(noteDetails[5]).to.be.true; // isPremium
            expect(noteDetails[6]).to.equal(price); // accessPrice
        });

        it("Should not allow duplicate note hashes", async function () {
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("duplicate content"));
            
            await noteMonetization.connect(user1).registerNote(
                hash,
                "First Note",
                false,
                0,
                "Education",
                "First note"
            );
            
            await expect(
                noteMonetization.connect(user2).registerNote(
                    hash,
                    "Second Note",
                    false,
                    0,
                    "Education",
                    "Second note"
                )
            ).to.be.revertedWith("Note hash already exists");
        });

        it("Should not allow empty title or hash", async function () {
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("content"));
            
            await expect(
                noteMonetization.connect(user1).registerNote(
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                    "Test Note",
                    false,
                    0,
                    "Education",
                    "Test"
                )
            ).to.be.revertedWith("Hash cannot be empty");
            
            await expect(
                noteMonetization.connect(user1).registerNote(
                    hash,
                    "",
                    false,
                    0,
                    "Education",
                    "Test"
                )
            ).to.be.revertedWith("Title cannot be empty");
        });
    });

    describe("Note Access", function () {
        beforeEach(async function () {
            // Register a free note
            const freeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("free content"));
            await noteMonetization.connect(user1).registerNote(
                freeHash,
                "Free Note",
                false,
                0,
                "Education",
                "A free note"
            );
            
            // Register a premium note
            const premiumHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("premium content"));
            await noteMonetization.connect(user1).registerNote(
                premiumHash,
                "Premium Note",
                true,
                ethers.utils.parseEther("5"),
                "Advanced",
                "A premium note"
            );
        });

        it("Should allow access to free notes for everyone", async function () {
            expect(await noteMonetization.checkNoteAccess(1, user2.address)).to.be.true;
            expect(await noteMonetization.checkNoteAccess(1, user3.address)).to.be.true;
        });

        it("Should restrict access to premium notes", async function () {
            expect(await noteMonetization.checkNoteAccess(2, user1.address)).to.be.true; // owner
            expect(await noteMonetization.checkNoteAccess(2, user2.address)).to.be.false; // non-owner
        });

        it("Should allow purchasing premium note access", async function () {
            const price = ethers.utils.parseEther("5");
            
            // Approve spending
            await moduloToken.connect(user2).approve(noteMonetization.address, price);
            
            // Purchase access
            await expect(
                noteMonetization.connect(user2).purchaseNoteAccess(2)
            ).to.emit(noteMonetization, "NoteAccessGranted");
            
            // Check access granted
            expect(await noteMonetization.checkNoteAccess(2, user2.address)).to.be.true;
        });

        it("Should not allow purchasing already owned access", async function () {
            const price = ethers.utils.parseEther("5");
            
            // First purchase
            await moduloToken.connect(user2).approve(noteMonetization.address, price);
            await noteMonetization.connect(user2).purchaseNoteAccess(2);
            
            // Try to purchase again
            await moduloToken.connect(user2).approve(noteMonetization.address, price);
            await expect(
                noteMonetization.connect(user2).purchaseNoteAccess(2)
            ).to.be.revertedWith("Already has access");
        });

        it("Should not allow owner to purchase their own note", async function () {
            const price = ethers.utils.parseEther("5");
            
            await moduloToken.connect(user1).approve(noteMonetization.address, price);
            await expect(
                noteMonetization.connect(user1).purchaseNoteAccess(2)
            ).to.be.revertedWith("Cannot purchase own note");
        });
    });

    describe("Earnings and Payments", function () {
        beforeEach(async function () {
            // Register a premium note
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("premium content"));
            await noteMonetization.connect(user1).registerNote(
                hash,
                "Premium Note",
                true,
                ethers.utils.parseEther("10"), // 10 MODO
                "Advanced",
                "A premium note"
            );
        });

        it("Should distribute payments correctly", async function () {
            const price = ethers.utils.parseEther("10");
            const platformFee = price.mul(250).div(10000); // 2.5%
            const ownerAmount = price.sub(platformFee);
            
            // Purchase access
            await moduloToken.connect(user2).approve(noteMonetization.address, price);
            await noteMonetization.connect(user2).purchaseNoteAccess(1);
            
            // Check earnings
            expect(await noteMonetization.userEarnings(user1.address)).to.equal(ownerAmount);
            expect(await noteMonetization.userEarnings(owner.address)).to.equal(platformFee);
        });

        it("Should allow withdrawing earnings", async function () {
            const price = ethers.utils.parseEther("10");
            
            // Purchase access
            await moduloToken.connect(user2).approve(noteMonetization.address, price);
            await noteMonetization.connect(user2).purchaseNoteAccess(1);
            
            // Check initial balances
            const initialBalance = await moduloToken.balanceOf(user1.address);
            const earnings = await noteMonetization.userEarnings(user1.address);
            
            // Withdraw earnings
            await expect(
                noteMonetization.connect(user1).withdrawEarnings(0)
            ).to.emit(noteMonetization, "EarningsWithdrawn");
            
            // Check final balance
            const finalBalance = await moduloToken.balanceOf(user1.address);
            expect(finalBalance).to.equal(initialBalance.add(earnings));
            expect(await noteMonetization.userEarnings(user1.address)).to.equal(0);
        });

        it("Should not allow withdrawing more than available", async function () {
            await expect(
                noteMonetization.connect(user1).withdrawEarnings(ethers.utils.parseEther("1"))
            ).to.be.revertedWith("No earnings to withdraw");
        });
    });

    describe("Note Management", function () {
        beforeEach(async function () {
            // Register a premium note
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("premium content"));
            await noteMonetization.connect(user1).registerNote(
                hash,
                "Premium Note",
                true,
                ethers.utils.parseEther("5"),
                "Advanced",
                "A premium note"
            );
        });

        it("Should allow owner to update note price", async function () {
            const newPrice = ethers.utils.parseEther("8");
            
            await expect(
                noteMonetization.connect(user1).updateNotePrice(1, newPrice)
            ).to.emit(noteMonetization, "PriceUpdated");
            
            const noteDetails = await noteMonetization.getNoteDetails(1);
            expect(noteDetails[6]).to.equal(newPrice);
        });

        it("Should not allow non-owner to update price", async function () {
            const newPrice = ethers.utils.parseEther("8");
            
            await expect(
                noteMonetization.connect(user2).updateNotePrice(1, newPrice)
            ).to.be.revertedWith("Not the owner of this note");
        });

        it("Should allow converting between free and premium", async function () {
            // Register a free note first
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("free content"));
            await noteMonetization.connect(user1).registerNote(
                hash,
                "Free Note",
                false,
                0,
                "Education",
                "A free note"
            );
            
            // Convert to premium
            const price = ethers.utils.parseEther("3");
            await noteMonetization.connect(user1).updateNotePremiumStatus(2, true, price);
            
            const noteDetails = await noteMonetization.getNoteDetails(2);
            expect(noteDetails[5]).to.be.true; // isPremium
            expect(noteDetails[6]).to.equal(price); // accessPrice
        });
    });

    describe("Platform Management", function () {
        it("Should allow owner to update platform fee", async function () {
            const newFee = 500; // 5%
            
            await expect(
                noteMonetization.updatePlatformFee(newFee)
            ).to.emit(noteMonetization, "PlatformFeeUpdated");
            
            expect(await noteMonetization.platformFeePercent()).to.equal(newFee);
        });

        it("Should not allow setting fee too high", async function () {
            const highFee = 1500; // 15% (above 10% max)
            
            await expect(
                noteMonetization.updatePlatformFee(highFee)
            ).to.be.revertedWith("Fee too high");
        });

        it("Should allow owner to update fee recipient", async function () {
            await noteMonetization.updateFeeRecipient(user3.address);
            expect(await noteMonetization.feeRecipient()).to.equal(user3.address);
        });

        it("Should not allow non-owner to update platform settings", async function () {
            await expect(
                noteMonetization.connect(user1).updatePlatformFee(500)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Pause functionality", function () {
        it("Should allow owner to pause and unpause", async function () {
            await noteMonetization.pause();
            expect(await noteMonetization.paused()).to.be.true;
            
            await noteMonetization.unpause();
            expect(await noteMonetization.paused()).to.be.false;
        });

        it("Should not allow operations when paused", async function () {
            await noteMonetization.pause();
            
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("content"));
            await expect(
                noteMonetization.connect(user1).registerNote(
                    hash,
                    "Test Note",
                    false,
                    0,
                    "Education",
                    "Test"
                )
            ).to.be.revertedWith("Pausable: paused");
        });
    });

    describe("Query functions", function () {
        beforeEach(async function () {
            // Register multiple notes for user1
            for (let i = 0; i < 5; i++) {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`content ${i}`));
                await noteMonetization.connect(user1).registerNote(
                    hash,
                    `Note ${i}`,
                    i % 2 === 0, // alternate between free and premium
                    i % 2 === 0 ? ethers.utils.parseEther("5") : 0,
                    "Education",
                    `Description ${i}`
                );
            }
        });

        it("Should return correct user notes with pagination", async function () {
            const userNotes = await noteMonetization.getUserNotes(user1.address, 0, 3);
            expect(userNotes.length).to.equal(3);
            expect(userNotes[0]).to.equal(1);
            expect(userNotes[1]).to.equal(2);
            expect(userNotes[2]).to.equal(3);
        });

        it("Should handle pagination correctly", async function () {
            const userNotes1 = await noteMonetization.getUserNotes(user1.address, 0, 2);
            const userNotes2 = await noteMonetization.getUserNotes(user1.address, 2, 3);
            
            expect(userNotes1.length).to.equal(2);
            expect(userNotes2.length).to.equal(3);
            expect(userNotes1[0]).to.equal(1);
            expect(userNotes2[0]).to.equal(3);
        });

        it("Should return empty array for out of bounds pagination", async function () {
            const userNotes = await noteMonetization.getUserNotes(user1.address, 10, 5);
            expect(userNotes.length).to.equal(0);
        });
    });
});
