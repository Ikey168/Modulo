const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log("🔗 Interacting with NoteRegistry contract...");
  console.log("==============================================");
  console.log(`📡 Network: ${networkName} (${network.chainId})`);
  console.log(`👤 Account: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ${getNetworkCurrency(network.chainId)}`);

  // Get contract address
  let contractAddress = process.env.CONTRACT_ADDRESS;
  
  // Try to load from deployment file if not provided
  if (!contractAddress || contractAddress === "YOUR_DEPLOYED_CONTRACT_ADDRESS") {
    contractAddress = loadContractAddress(network.chainId);
  }
  
  if (!contractAddress) {
    console.error("❌ Contract address not found!");
    console.error("Please set CONTRACT_ADDRESS environment variable or deploy the contract first");
    console.error(`Run: npm run deploy:${getNetworkName(network.chainId)}`);
    process.exit(1);
  }

  // Get contract instance
  const NoteRegistry = await ethers.getContractFactory("NoteRegistry");
  const noteRegistry = NoteRegistry.attach(contractAddress);

  console.log(`📋 Connected to NoteRegistry at: ${contractAddress}`);
  console.log(`🔗 Explorer: ${getExplorerUrl(network.chainId, contractAddress)}`);

  // Example interactions
  try {
    console.log("\n📊 Getting contract information...");
    
    // Get total note count
    const totalNotes = await noteRegistry.getTotalNoteCount();
    console.log(`📝 Total notes registered: ${totalNotes}`);

    // Get user's notes
    const userNotes = await noteRegistry.getNotesByOwner(deployer.address);
    console.log(`👤 Your notes: ${userNotes.length}`);
    
    // Get active note count
    const activeCount = await noteRegistry.getActiveNoteCount(deployer.address);
    console.log(`✅ Your active notes: ${activeCount}`);

    // Example: Register a new note
    const testContent = `Test note from ${networkName} - ${new Date().toISOString()}`;
    const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testContent));
    const testTitle = `${networkName} Test Note`;

    console.log("\n🔄 Registering a new note...");
    console.log(`📝 Content: ${testContent}`);
    console.log(`🏷️  Title: ${testTitle}`);
    console.log(`#️⃣  Hash: ${testHash}`);
    
    // Check if note already exists
    const [exists, isOwner, isActive] = await noteRegistry.verifyNote(testHash);
    
    if (exists) {
      console.log("⚠️  Note already exists on blockchain");
      console.log(`📊 Status: exists=${exists}, isOwner=${isOwner}, isActive=${isActive}`);
    } else {
      // Register the note
      console.log("📤 Submitting registration transaction...");
      const registerTx = await noteRegistry.registerNote(testHash, testTitle);
      console.log(`📝 Transaction hash: ${registerTx.hash}`);
      console.log(`🔗 Transaction: ${getExplorerUrl(network.chainId, registerTx.hash, 'tx')}`);
      
      // Wait for confirmation
      console.log("⏳ Waiting for confirmation...");
      const receipt = await registerTx.wait();
      console.log(`✅ Note registered in block: ${receipt.blockNumber}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`💰 Cost: ${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice))} ${getNetworkCurrency(network.chainId)}`);

      // Get the note ID from the event
      const event = receipt.events?.find(e => e.event === "NoteRegistered");
      if (event) {
        const noteId = event.args.noteId;
        console.log(`🆔 Note ID: ${noteId}`);

        // Retrieve the note details
        console.log("\n📋 Note details:");
        const note = await noteRegistry.getNote(noteId);
        console.log(`👤 Owner: ${note.owner}`);
        console.log(`#️⃣  Hash: ${note.hash}`);
        console.log(`🏷️  Title: ${note.title}`);
        console.log(`📅 Timestamp: ${new Date(note.timestamp * 1000).toISOString()}`);
        console.log(`✅ Active: ${note.isActive}`);
        
        // Verify the note
        console.log("\n🔍 Verifying note...");
        const [verifyExists, verifyIsOwner, verifyIsActive] = await noteRegistry.verifyNote(testHash);
        console.log(`📊 Verification: exists=${verifyExists}, isOwner=${verifyIsOwner}, isActive=${verifyIsActive}`);
        
        // Test note retrieval by hash
        const noteByHash = await noteRegistry.getNoteByHash(testHash);
        console.log(`✅ Retrieved by hash: ${noteByHash.title}`);
      }
    }

    // Display updated statistics
    console.log("\n📊 Updated statistics:");
    const newTotalNotes = await noteRegistry.getTotalNoteCount();
    const newUserNotes = await noteRegistry.getNotesByOwner(deployer.address);
    const newActiveCount = await noteRegistry.getActiveNoteCount(deployer.address);
    
    console.log(`📝 Total notes: ${newTotalNotes}`);
    console.log(`👤 Your notes: ${newUserNotes.length}`);
    console.log(`✅ Your active notes: ${newActiveCount}`);
    
    if (newUserNotes.length > 0) {
      console.log(`🆔 Your note IDs: [${newUserNotes.join(", ")}]`);
    }

    // Test additional functionality if user has notes
    if (newUserNotes.length > 0) {
      const noteId = newUserNotes[newUserNotes.length - 1]; // Get latest note
      
      console.log(`\n🧪 Testing additional functionality with note ID ${noteId}...`);
      
      // Test ownership check
      const isOwnerCheck = await noteRegistry.isNoteOwner(noteId, deployer.address);
      console.log(`👤 Ownership verified: ${isOwnerCheck}`);
      
      // Test legacy isOwner function
      const legacyOwnerCheck = await noteRegistry.isOwner(noteId);
      console.log(`👤 Legacy ownership check: ${legacyOwnerCheck}`);
    }

    console.log("\n✅ All interactions completed successfully!");

  } catch (error) {
    console.error("\n❌ Error during contract interaction:");
    console.error("=====================================");
    console.error("Message:", error.message);
    if (error.code) console.error("Code:", error.code);
    if (error.reason) console.error("Reason:", error.reason);
    if (error.transaction) {
      console.error("Transaction:", error.transaction.hash);
    }
    console.error("=====================================");
  }
}

function getNetworkCurrency(chainId) {
  switch (chainId) {
    case 1: // Mainnet
    case 11155111: // Sepolia
    case 1337: // Local
    case 31337: // Hardhat
      return "ETH";
    case 137: // Polygon
    case 80001: // Mumbai
      return "MATIC";
    default:
      return "ETH";
  }
}

function getNetworkName(chainId) {
  switch (chainId) {
    case 1: return "mainnet";
    case 11155111: return "sepolia";
    case 137: return "polygon";
    case 80001: return "mumbai";
    case 1337:
    case 31337: return "local";
    default: return `chain-${chainId}`;
  }
}

function getExplorerUrl(chainId, address, type = 'address') {
  const baseUrls = {
    1: "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    137: "https://polygonscan.com",
    80001: "https://mumbai.polygonscan.com"
  };
  
  const baseUrl = baseUrls[chainId];
  if (!baseUrl) return `Local network - no explorer`;
  
  return `${baseUrl}/${type}/${address}`;
}

function loadContractAddress(chainId) {
  try {
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    const networkName = getNetworkName(chainId);
    const filePath = path.join(deploymentsDir, `${networkName}.json`);
    
    if (fs.existsSync(filePath)) {
      const deployment = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return deployment.address;
    }
  } catch (error) {
    console.warn(`⚠️  Could not load deployment info: ${error.message}`);
  }
  return null;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Interaction failed!");
    console.error("======================");
    console.error(error);
    process.exit(1);
  });
