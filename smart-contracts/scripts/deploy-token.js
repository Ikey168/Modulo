const hre = require("hardhat");

async function main() {
    console.log("Starting deployment of Modulo Token and Note Monetization contracts...");
    
    // Get the ContractFactory and Signers here.
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy ModuloToken first
    console.log("\n=== Deploying ModuloToken ===");
    const ModuloToken = await hre.ethers.getContractFactory("ModuloToken");
    const moduloToken = await ModuloToken.deploy();
    await moduloToken.deployed();
    
    console.log("ModuloToken deployed to:", moduloToken.address);
    console.log("Token name:", await moduloToken.name());
    console.log("Token symbol:", await moduloToken.symbol());
    console.log("Initial supply:", hre.ethers.utils.formatEther(await moduloToken.totalSupply()));
    console.log("Max supply:", hre.ethers.utils.formatEther(await moduloToken.maxSupply()));

    // Deploy NoteMonetization
    console.log("\n=== Deploying NoteMonetization ===");
    const NoteMonetization = await hre.ethers.getContractFactory("NoteMonetization");
    const noteMonetization = await NoteMonetization.deploy(moduloToken.address);
    await noteMonetization.deployed();
    
    console.log("NoteMonetization deployed to:", noteMonetization.address);
    console.log("Connected ModuloToken:", await noteMonetization.moduloToken());
    console.log("Platform fee:", await noteMonetization.platformFeePercent(), "basis points");

    // Setup initial configuration
    console.log("\n=== Initial Configuration ===");
    
    // Add NoteMonetization contract as a minter for ModuloToken (for potential rewards)
    console.log("Adding NoteMonetization as minter...");
    const addMinterTx = await moduloToken.addMinter(noteMonetization.address);
    await addMinterTx.wait();
    console.log("✓ NoteMonetization added as minter");

    // Transfer some initial tokens to the deployer for testing
    const initialAmount = hre.ethers.utils.parseEther("1000"); // 1000 MODO tokens
    console.log("Minting initial tokens for testing...");
    const mintTx = await moduloToken.mint(deployer.address, initialAmount);
    await mintTx.wait();
    console.log("✓ Minted", hre.ethers.utils.formatEther(initialAmount), "MODO tokens for testing");

    console.log("\n=== Deployment Summary ===");
    console.log("ModuloToken address:", moduloToken.address);
    console.log("NoteMonetization address:", noteMonetization.address);
    console.log("Deployer address:", deployer.address);
    console.log("Network:", hre.network.name);
    
    // Save deployment info to file
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            ModuloToken: {
                address: moduloToken.address,
                name: await moduloToken.name(),
                symbol: await moduloToken.symbol(),
                totalSupply: (await moduloToken.totalSupply()).toString(),
                maxSupply: (await moduloToken.maxSupply()).toString()
            },
            NoteMonetization: {
                address: noteMonetization.address,
                moduloToken: await noteMonetization.moduloToken(),
                platformFee: (await noteMonetization.platformFeePercent()).toString()
            }
        }
    };

    const fs = require('fs');
    const deploymentPath = `./deployments/${hre.network.name}-deployment.json`;
    
    // Create deployments directory if it doesn't exist
    if (!fs.existsSync('./deployments')) {
        fs.mkdirSync('./deployments');
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("Deployment info saved to:", deploymentPath);

    console.log("\n🎉 Deployment completed successfully!");
    
    // Display important information for verification
    console.log("\n=== For Etherscan Verification ===");
    console.log("ModuloToken constructor args: []");
    console.log("NoteMonetization constructor args:", `["${moduloToken.address}"]`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
