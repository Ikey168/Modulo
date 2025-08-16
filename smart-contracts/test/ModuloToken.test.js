const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ModuloToken", function () {
    let ModuloToken;
    let moduloToken;
    let owner;
    let user1;
    let user2;
    let minter;

    beforeEach(async function () {
        [owner, user1, user2, minter] = await ethers.getSigners();
        
        ModuloToken = await ethers.getContractFactory("ModuloToken");
        moduloToken = await ModuloToken.deploy();
        await moduloToken.deployed();
    });

    describe("Deployment", function () {
        it("Should set the right name and symbol", async function () {
            expect(await moduloToken.name()).to.equal("Modulo Token");
            expect(await moduloToken.symbol()).to.equal("MODO");
        });

        it("Should set the right decimals", async function () {
            expect(await moduloToken.decimals()).to.equal(18);
        });

        it("Should assign the total supply to the owner", async function () {
            const ownerBalance = await moduloToken.balanceOf(owner.address);
            const totalSupply = await moduloToken.totalSupply();
            expect(totalSupply).to.equal(ownerBalance);
        });

        it("Should set the owner as a minter", async function () {
            expect(await moduloToken.minters(owner.address)).to.be.true;
        });

        it("Should have correct max supply", async function () {
            const maxSupply = await moduloToken.maxSupply();
            expect(maxSupply).to.equal(ethers.utils.parseEther("1000000000")); // 1 billion
        });
    });

    describe("Minting", function () {
        it("Should allow owner to add minters", async function () {
            await moduloToken.addMinter(minter.address);
            expect(await moduloToken.minters(minter.address)).to.be.true;
        });

        it("Should not allow non-owner to add minters", async function () {
            await expect(
                moduloToken.connect(user1).addMinter(minter.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should allow minters to mint tokens", async function () {
            await moduloToken.addMinter(minter.address);
            const mintAmount = ethers.utils.parseEther("1000");
            
            await moduloToken.connect(minter).mint(user1.address, mintAmount);
            expect(await moduloToken.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("Should not allow non-minters to mint tokens", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            
            await expect(
                moduloToken.connect(user1).mint(user2.address, mintAmount)
            ).to.be.revertedWith("Not authorized to mint");
        });

        it("Should not allow minting beyond max supply", async function () {
            const totalSupply = await moduloToken.totalSupply();
            const maxSupply = await moduloToken.maxSupply();
            const excessAmount = maxSupply.sub(totalSupply).add(1);
            
            await expect(
                moduloToken.mint(user1.address, excessAmount)
            ).to.be.revertedWith("Exceeds maximum supply");
        });

        it("Should emit TokensMinted event", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            
            await expect(moduloToken.mint(user1.address, mintAmount))
                .to.emit(moduloToken, "TokensMinted")
                .withArgs(user1.address, mintAmount);
        });
    });

    describe("Burning", function () {
        beforeEach(async function () {
            // Transfer some tokens to user1 for burning tests
            await moduloToken.transfer(user1.address, ethers.utils.parseEther("1000"));
        });

        it("Should allow users to burn their tokens", async function () {
            const burnAmount = ethers.utils.parseEther("100");
            const initialBalance = await moduloToken.balanceOf(user1.address);
            
            await moduloToken.connect(user1).burn(burnAmount);
            
            const finalBalance = await moduloToken.balanceOf(user1.address);
            expect(finalBalance).to.equal(initialBalance.sub(burnAmount));
        });

        it("Should emit TokensBurned event", async function () {
            const burnAmount = ethers.utils.parseEther("100");
            
            await expect(moduloToken.connect(user1).burn(burnAmount))
                .to.emit(moduloToken, "TokensBurned")
                .withArgs(user1.address, burnAmount);
        });

        it("Should allow burning with approval", async function () {
            const burnAmount = ethers.utils.parseEther("100");
            
            // user1 approves user2 to burn their tokens
            await moduloToken.connect(user1).approve(user2.address, burnAmount);
            
            const initialBalance = await moduloToken.balanceOf(user1.address);
            await moduloToken.connect(user2).burnFrom(user1.address, burnAmount);
            
            const finalBalance = await moduloToken.balanceOf(user1.address);
            expect(finalBalance).to.equal(initialBalance.sub(burnAmount));
        });
    });

    describe("Pause functionality", function () {
        it("Should allow owner to pause and unpause", async function () {
            await moduloToken.pause();
            expect(await moduloToken.paused()).to.be.true;
            
            await moduloToken.unpause();
            expect(await moduloToken.paused()).to.be.false;
        });

        it("Should not allow transfers when paused", async function () {
            await moduloToken.pause();
            
            await expect(
                moduloToken.transfer(user1.address, ethers.utils.parseEther("100"))
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should not allow minting when paused", async function () {
            await moduloToken.pause();
            
            await expect(
                moduloToken.mint(user1.address, ethers.utils.parseEther("100"))
            ).to.be.revertedWith("Pausable: paused");
        });
    });

    describe("Access control", function () {
        it("Should allow owner to remove minters", async function () {
            await moduloToken.addMinter(minter.address);
            expect(await moduloToken.minters(minter.address)).to.be.true;
            
            await moduloToken.removeMinter(minter.address);
            expect(await moduloToken.minters(minter.address)).to.be.false;
        });

        it("Should not allow non-owner to pause", async function () {
            await expect(
                moduloToken.connect(user1).pause()
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Emergency functions", function () {
        it("Should allow owner to recover accidentally sent ETH", async function () {
            // Send some ETH to the contract
            await owner.sendTransaction({
                to: moduloToken.address,
                value: ethers.utils.parseEther("1")
            });
            
            const initialBalance = await owner.getBalance();
            await moduloToken.recoverETH();
            
            // Owner should have recovered the ETH (minus gas costs)
            const finalBalance = await owner.getBalance();
            expect(finalBalance).to.be.gt(initialBalance);
        });
    });
});
