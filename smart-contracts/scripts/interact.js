const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Interacting with NoteRegistry contract...");
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

  // Replace with your deployed contract address
  const contractAddress = process.env.CONTRACT_ADDRESS || "YOUR_DEPLOYED_CONTRACT_ADDRESS";
  
  if (contractAddress === "YOUR_DEPLOYED_CONTRACT_ADDRESS") {
    console.error("Please set CONTRACT_ADDRESS environment variable or update the script");
    process.exit(1);
  }

  // Get contract instance
  const NoteRegistry = await ethers.getContractFactory("NoteRegistry");
  const noteRegistry = NoteRegistry.attach(contractAddress);

  console.log(`Connected to NoteRegistry at: ${contractAddress}`);

  // Example interactions
  try {
    // Get total note count
    const totalNotes = await noteRegistry.getTotalNoteCount();
    console.log(`Total notes registered: ${totalNotes}`);

    // Example: Register a new note
    const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Example note content"));
    const testTitle = "Example Note";

    console.log("\nRegistering a new note...");
    const tx = await noteRegistry.registerNote(testHash, testTitle);
    console.log(`Transaction hash: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`Note registered in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Get the note ID from the event
    const event = receipt.events?.find(e => e.event === "NoteRegistered");
    if (event) {
      const noteId = event.args.noteId;
      console.log(`Note ID: ${noteId}`);

      // Retrieve the note
      const note = await noteRegistry.getNote(noteId);
      console.log("\nNote details:");
      console.log(`Owner: ${note.owner}`);
      console.log(`Hash: ${note.hash}`);
      console.log(`Title: ${note.title}`);
      console.log(`Timestamp: ${new Date(note.timestamp * 1000).toISOString()}`);
      console.log(`Active: ${note.isActive}`);
    }

    // Verify the note
    const [exists, isOwner, isActive] = await noteRegistry.verifyNote(testHash);
    console.log("\nNote verification:");
    console.log(`Exists: ${exists}`);
    console.log(`Is Owner: ${isOwner}`);
    console.log(`Is Active: ${isActive}`);

    // Get owner's notes
    const ownerNotes = await noteRegistry.getNotesByOwner(deployer.address);
    console.log(`\nNotes owned by ${deployer.address}: ${ownerNotes.length}`);
    console.log(`Note IDs: [${ownerNotes.join(", ")}]`);

    // Get active note count
    const activeCount = await noteRegistry.getActiveNoteCount(deployer.address);
    console.log(`Active notes: ${activeCount}`);

  } catch (error) {
    console.error("Error interacting with contract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
