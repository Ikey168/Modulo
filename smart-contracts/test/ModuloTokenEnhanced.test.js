const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ModuloToken - Enhanced Coverage", function () {
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

    describe("Deployment and Initial State", function () {
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
            expect(totalSupply.toString()).to.equal(ownerBalance.toString());
        });

        it("Should set the owner as a minter", async function () {
            expect(await moduloToken.minters(owner.address)).to.be.true;
        });

        it("Should have correct max supply", async function () {
            const maxSupply = await moduloToken.maxSupply();
            expect(maxSupply.toString()).to.equal(ethers.utils.parseEther("1000000000").toString());
        });
        
        it("Should initialize with correct total supply", async function () {
            const totalSupply = await moduloToken.totalSupply();
            expect(totalSupply.toString()).to.equal(ethers.utils.parseEther("100000000").toString());
        });
    });

    describe("Minter Management - Enhanced Coverage", function () {
        it("Should allow owner to add minters", async function () {
            await moduloToken.addMinter(minter.address);
            expect(await moduloToken.minters(minter.address)).to.be.true;
        });

        it("Should not allow non-owner to add minters", async function () {
            try {
                await moduloToken.connect(user1).addMinter(minter.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("caller is not the owner");
            }
        });

        it("Should allow owner to remove minters", async function () {
            await moduloToken.addMinter(minter.address);
            await moduloToken.removeMinter(minter.address);
            expect(await moduloToken.minters(minter.address)).to.be.false;
        });

        it("Should not allow removing non-existent minters", async function () {
            try {
                await moduloToken.removeMinter(user1.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Address is not a minter");
            }
        });
    });

    describe("Minting - Enhanced Branch Coverage", function () {
        beforeEach(async function () {
            await moduloToken.addMinter(minter.address);
        });

        it("Should allow minters to mint tokens", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            const balanceBefore = await moduloToken.balanceOf(user1.address);
            
            await moduloToken.connect(minter).mint(user1.address, mintAmount);
            
            const balanceAfter = await moduloToken.balanceOf(user1.address);
            expect(balanceAfter.sub(balanceBefore).toString()).to.equal(mintAmount.toString());
        });

        it("Should not allow non-minters to mint tokens", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            try {
                await moduloToken.connect(user1).mint(user2.address, mintAmount);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Not authorized to mint");
            }
        });

        it("Should not allow minting beyond max supply", async function () {
            // Mint close to max supply
            const maxSupply = await moduloToken.maxSupply();
            const totalSupply = await moduloToken.totalSupply();
            const remaining = maxSupply.sub(totalSupply);
            
            // Try to mint more than remaining
            const excessAmount = remaining.add(ethers.utils.parseEther("1"));
            
            try {
                await moduloToken.connect(minter).mint(user1.address, excessAmount);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Exceeds maximum supply");
            }
        });

        it("Should allow minting exactly to max supply", async function () {
            const maxSupply = await moduloToken.maxSupply();
            const totalSupply = await moduloToken.totalSupply();
            const remaining = maxSupply.sub(totalSupply);
            
            await moduloToken.connect(minter).mint(user1.address, remaining);
            
            const finalSupply = await moduloToken.totalSupply();
            expect(finalSupply.toString()).to.equal(maxSupply.toString());
        });

        it("Should emit TokensMinted event", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            const tx = await moduloToken.connect(minter).mint(user1.address, mintAmount);
            const receipt = await tx.wait();
            
            // Check for Transfer event (ERC20 standard)
            const transferEvent = receipt.events?.find(e => e.event === 'Transfer');
            expect(transferEvent).to.exist;
            expect(transferEvent.args.to).to.equal(user1.address);
            expect(transferEvent.args.value.toString()).to.equal(mintAmount.toString());
        });

        it("Should handle zero amount minting", async function () {
            try {
                await moduloToken.connect(minter).mint(user1.address, 0);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Amount must be greater than 0");
            }
        });
    });

    describe("Burning - Enhanced Branch Coverage", function () {
        beforeEach(async function () {
            // Give user1 some tokens to burn
            await moduloToken.addMinter(minter.address);
            await moduloToken.connect(minter).mint(user1.address, ethers.utils.parseEther("10000"));
        });

        it("Should allow users to burn their tokens", async function () {
            const burnAmount = ethers.utils.parseEther("1000");
            const balanceBefore = await moduloToken.balanceOf(user1.address);
            
            await moduloToken.connect(user1).burn(burnAmount);
            
            const balanceAfter = await moduloToken.balanceOf(user1.address);
            expect(balanceBefore.sub(balanceAfter).toString()).to.equal(burnAmount.toString());
        });

        it("Should emit Transfer event for burning", async function () {
            const burnAmount = ethers.utils.parseEther("1000");
            const tx = await moduloToken.connect(user1).burn(burnAmount);
            const receipt = await tx.wait();
            
            const transferEvent = receipt.events?.find(e => e.event === 'Transfer');
            expect(transferEvent).to.exist;
            expect(transferEvent.args.from).to.equal(user1.address);
            expect(transferEvent.args.to).to.equal(ethers.constants.AddressZero);
            expect(transferEvent.args.value.toString()).to.equal(burnAmount.toString());
        });

        it("Should allow burning with approval", async function () {
            const burnAmount = ethers.utils.parseEther("1000");
            
            // User1 approves user2 to burn their tokens
            await moduloToken.connect(user1).approve(user2.address, burnAmount);
            
            const balanceBefore = await moduloToken.balanceOf(user1.address);
            await moduloToken.connect(user2).burnFrom(user1.address, burnAmount);
            const balanceAfter = await moduloToken.balanceOf(user1.address);
            
            expect(balanceBefore.sub(balanceAfter).toString()).to.equal(burnAmount.toString());
        });

        it("Should not allow burning more than balance", async function () {
            const balance = await moduloToken.balanceOf(user1.address);
            const excessAmount = balance.add(ethers.utils.parseEther("1"));
            
            try {
                await moduloToken.connect(user1).burn(excessAmount);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("burn amount exceeds balance");
            }
        });

        it("Should handle zero amount burning", async function () {
            const balanceBefore = await moduloToken.balanceOf(user1.address);
            await moduloToken.connect(user1).burn(0);
            const balanceAfter = await moduloToken.balanceOf(user1.address);
            expect(balanceAfter.toString()).to.equal(balanceBefore.toString());
        });
    });

    describe("Pause Functionality - Branch Coverage", function () {
        it("Should allow owner to pause and unpause", async function () {
            expect(await moduloToken.paused()).to.be.false;
            
            await moduloToken.pause();
            expect(await moduloToken.paused()).to.be.true;
            
            await moduloToken.unpause();
            expect(await moduloToken.paused()).to.be.false;
        });

        it("Should not allow transfers when paused", async function () {
            await moduloToken.pause();
            
            try {
                await moduloToken.transfer(user1.address, ethers.utils.parseEther("100"));
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("paused");
            }
        });

        it("Should not allow minting when paused", async function () {
            await moduloToken.addMinter(minter.address);
            await moduloToken.pause();
            
            try {
                await moduloToken.connect(minter).mint(user1.address, ethers.utils.parseEther("100"));
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("paused");
            }
        });

        it("Should not allow burning when paused", async function () {
            // Give user1 some tokens first
            await moduloToken.addMinter(minter.address);
            await moduloToken.connect(minter).mint(user1.address, ethers.utils.parseEther("1000"));
            
            await moduloToken.pause();
            
            // Burning should not work when paused
            try {
                await moduloToken.connect(user1).burn(ethers.utils.parseEther("100"));
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("paused");
            }
        });

        it("Should not allow non-owner to pause", async function () {
            try {
                await moduloToken.connect(user1).pause();
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("caller is not the owner");
            }
        });

        it("Should not allow non-owner to unpause", async function () {
            await moduloToken.pause();
            try {
                await moduloToken.connect(user1).unpause();
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("caller is not the owner");
            }
        });
    });

    describe("Edge Cases and Security - Branch Coverage", function () {
        it("Should handle zero address in minter management", async function () {
            try {
                await moduloToken.addMinter(ethers.constants.AddressZero);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Invalid minter address");
            }
        });

        it("Should handle duplicate minter additions", async function () {
            await moduloToken.addMinter(minter.address);
            expect(await moduloToken.minters(minter.address)).to.be.true;
            
            // Adding again should cause an error
            try {
                await moduloToken.addMinter(minter.address);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("Address is already a minter");
            }
        });

        it("Should handle large numbers without overflow", async function () {
            // Test with maximum safe values
            const largeAmount = ethers.BigNumber.from("2").pow(200); // Smaller than max uint256
            
            try {
                await moduloToken.connect(owner).mint(user1.address, largeAmount);
                expect.fail("Should have thrown error due to max supply");
            } catch (error) {
                expect(error.message).to.include("Exceeds maximum supply");
            }
        });

        it("Should handle allowance edge cases", async function () {
            await moduloToken.approve(user1.address, ethers.utils.parseEther("1000"));
            
            const allowance = await moduloToken.allowance(owner.address, user1.address);
            expect(allowance.toString()).to.equal(ethers.utils.parseEther("1000").toString());
            
            // Approve zero should reset allowance
            await moduloToken.approve(user1.address, 0);
            const zeroAllowance = await moduloToken.allowance(owner.address, user1.address);
            expect(zeroAllowance.toString()).to.equal("0");
        });

        it("Should handle emergency recovery correctly", async function () {
            // Send some ETH to the contract (simulate accidental send)
            await owner.sendTransaction({
                to: moduloToken.address,
                value: ethers.utils.parseEther("1")
            });
            
            const contractBalance = await ethers.provider.getBalance(moduloToken.address);
            expect(contractBalance.gt(0)).to.be.true;
            
            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
            
            // Recover ETH
            const tx = await moduloToken.recoverETH();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice || tx.gasPrice);
            
            const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
            
            // Owner should have received the ETH minus gas costs
            const expectedIncrease = contractBalance.sub(gasUsed);
            const actualIncrease = ownerBalanceAfter.sub(ownerBalanceBefore);
            
            // Allow for small gas calculation differences
            expect(actualIncrease.add(gasUsed).toString()).to.equal(contractBalance.toString());
        });

        it("Should not allow emergency recovery by non-owner", async function () {
            try {
                await moduloToken.connect(user1).recoverETH();
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("caller is not the owner");
            }
        });
    });

    describe("Transfer and Allowance Branch Coverage", function () {
        beforeEach(async function () {
            await moduloToken.addMinter(minter.address);
            await moduloToken.connect(minter).mint(user1.address, ethers.utils.parseEther("10000"));
        });

        it("Should handle transfer to self", async function () {
            const balanceBefore = await moduloToken.balanceOf(user1.address);
            await moduloToken.connect(user1).transfer(user1.address, ethers.utils.parseEther("100"));
            const balanceAfter = await moduloToken.balanceOf(user1.address);
            expect(balanceAfter.toString()).to.equal(balanceBefore.toString());
        });

        it("Should handle zero amount transfers", async function () {
            const balanceBefore = await moduloToken.balanceOf(user1.address);
            await moduloToken.connect(user1).transfer(user2.address, 0);
            const balanceAfter = await moduloToken.balanceOf(user1.address);
            expect(balanceAfter.toString()).to.equal(balanceBefore.toString());
        });

        it("Should handle transferFrom with exact allowance", async function () {
            const transferAmount = ethers.utils.parseEther("500");
            
            await moduloToken.connect(user1).approve(user2.address, transferAmount);
            
            const user1BalanceBefore = await moduloToken.balanceOf(user1.address);
            const user2BalanceBefore = await moduloToken.balanceOf(user2.address);
            
            await moduloToken.connect(user2).transferFrom(user1.address, user2.address, transferAmount);
            
            const user1BalanceAfter = await moduloToken.balanceOf(user1.address);
            const user2BalanceAfter = await moduloToken.balanceOf(user2.address);
            
            expect(user1BalanceBefore.sub(user1BalanceAfter).toString()).to.equal(transferAmount.toString());
            expect(user2BalanceAfter.sub(user2BalanceBefore).toString()).to.equal(transferAmount.toString());
            
            // Allowance should be zero after exact use
            const remainingAllowance = await moduloToken.allowance(user1.address, user2.address);
            expect(remainingAllowance.toString()).to.equal("0");
        });

        it("Should handle insufficient allowance", async function () {
            const allowedAmount = ethers.utils.parseEther("500");
            const transferAmount = ethers.utils.parseEther("1000");
            
            await moduloToken.connect(user1).approve(user2.address, allowedAmount);
            
            try {
                await moduloToken.connect(user2).transferFrom(user1.address, user2.address, transferAmount);
                expect.fail("Should have thrown error");
            } catch (error) {
                expect(error.message).to.include("insufficient allowance");
            }
        });
    });
});
