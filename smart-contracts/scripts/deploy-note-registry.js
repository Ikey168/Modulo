const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting deployment of NoteRegistry contract...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

    // Deploy NoteRegistry contract
    console.log("\n=== Deploying NoteRegistry ===");
    const NoteRegistry = await ethers.getContractFactory("NoteRegistry");
    const noteRegistry = await NoteRegistry.deploy();
    await noteRegistry.deployed();

    console.log("NoteRegistry deployed to:", noteRegistry.address);

    // Test the contract
    console.log("\n=== Testing Contract ===");
    const totalNotes = await noteRegistry.getTotalNoteCount();
    console.log("Initial total notes:", totalNotes.toString());

    // Register a test note
    const testContent = "Test note for blockchain integration";
    const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testContent));
    const testTitle = "Blockchain Integration Test Note";

    console.log("Registering test note...");
    const registerTx = await noteRegistry.registerNote(testHash, testTitle);
    const receipt = await registerTx.wait();
    console.log("✅ Test note registered successfully");

    // Get the note details
    const noteDetails = await noteRegistry.getNote(1);
    console.log("Note details:");
    console.log("  Owner:", noteDetails.owner);
    console.log("  Hash:", noteDetails.hash);
    console.log("  Title:", noteDetails.title);
    console.log("  Active:", noteDetails.isActive);
    console.log("  Timestamp:", new Date(noteDetails.timestamp * 1000).toISOString());

    // Update deployment info
    const deploymentInfo = {
        network: "localhost",
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            NoteRegistry: {
                address: noteRegistry.address,
                name: "Note Registry",
                description: "Blockchain-based registry for note hashes and ownership",
                totalNotes: (await noteRegistry.getTotalNoteCount()).toString()
            }
        }
    };

    // Load existing deployment info if it exists
    const deploymentPath = "./deployments/localhost-deployment.json";
    if (fs.existsSync(deploymentPath)) {
        const existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        deploymentInfo.contracts = { ...existingDeployment.contracts, ...deploymentInfo.contracts };
    }

    // Ensure deployments directory exists
    const deploymentsDir = path.dirname(deploymentPath);
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    // Save deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n=== Deployment Summary ===");
    console.log("NoteRegistry address:", noteRegistry.address);
    console.log("Deployer address:", deployer.address);
    console.log("Network: localhost");
    console.log("Deployment info saved to:", deploymentPath);

    console.log("\n🎉 Deployment completed successfully!");

    console.log("\n=== For Backend Integration ===");
    console.log("Add this to application.properties:");
    console.log(`blockchain.contract.note-registry-address=${noteRegistry.address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
