const hre = require("hardhat");

async function main() {
    console.log("Testing Modulo Token and Note Monetization contracts...");
    
    // Load deployment info
    const fs = require('fs');
    const deploymentPath = `./deployments/${hre.network.name}-deployment.json`;
    
    if (!fs.existsSync(deploymentPath)) {
        console.error("Deployment file not found:", deploymentPath);
        console.log("Please run deployment script first: npm run deploy");
        process.exit(1);
    }
    
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log("Loaded deployment info for network:", deploymentInfo.network);
    
    // Get signers
    const [owner, user1, user2] = await hre.ethers.getSigners();
    console.log("Owner address:", owner.address);
    console.log("User1 address:", user1.address);
    console.log("User2 address:", user2.address);
    
    // Get contract instances
    const ModuloToken = await hre.ethers.getContractFactory("ModuloToken");
    const moduloToken = ModuloToken.attach(deploymentInfo.contracts.ModuloToken.address);
    
    const NoteMonetization = await hre.ethers.getContractFactory("NoteMonetization");
    const noteMonetization = NoteMonetization.attach(deploymentInfo.contracts.NoteMonetization.address);
    
    console.log("\n=== Contract Status ===");
    console.log("ModuloToken total supply:", hre.ethers.utils.formatEther(await moduloToken.totalSupply()));
    console.log("Owner MODO balance:", hre.ethers.utils.formatEther(await moduloToken.balanceOf(owner.address)));
    console.log("Total notes registered:", (await noteMonetization.noteCount()).toString());
    
    // Test 1: Transfer tokens to test users
    console.log("\n=== Test 1: Token Distribution ===");
    const transferAmount = hre.ethers.utils.parseEther("100"); // 100 MODO tokens
    
    console.log("Transferring tokens to test users...");
    await moduloToken.transfer(user1.address, transferAmount);
    await moduloToken.transfer(user2.address, transferAmount);
    
    console.log("User1 MODO balance:", hre.ethers.utils.formatEther(await moduloToken.balanceOf(user1.address)));
    console.log("User2 MODO balance:", hre.ethers.utils.formatEther(await moduloToken.balanceOf(user2.address)));
    
    // Test 2: Register a free note
    console.log("\n=== Test 2: Free Note Registration ===");
    const freeNoteHash = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("This is my free note content"));
    
    const freeNoteTx = await noteMonetization.connect(user1).registerNote(
        freeNoteHash,
        "My Free Note",
        false, // not premium
        0,     // no access price
        "Educational",
        "A free educational note for everyone"
    );
    await freeNoteTx.wait();
    
    const freeNoteId = await noteMonetization.noteCount();
    console.log("Free note registered with ID:", freeNoteId.toString());
    
    // Check access to free note
    const hasAccessFree = await noteMonetization.checkNoteAccess(freeNoteId, user2.address);
    console.log("User2 has access to free note:", hasAccessFree);
    
    // Test 3: Register a premium note
    console.log("\n=== Test 3: Premium Note Registration ===");
    const premiumNoteHash = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("This is my premium note content"));
    const accessPrice = hre.ethers.utils.parseEther("5"); // 5 MODO tokens
    
    const premiumNoteTx = await noteMonetization.connect(user1).registerNote(
        premiumNoteHash,
        "My Premium Note",
        true,  // is premium
        accessPrice,
        "Advanced",
        "Advanced tutorial worth paying for"
    );
    await premiumNoteTx.wait();
    
    const premiumNoteId = await noteMonetization.noteCount();
    console.log("Premium note registered with ID:", premiumNoteId.toString());
    console.log("Access price:", hre.ethers.utils.formatEther(accessPrice), "MODO");
    
    // Check access to premium note (should be false for user2)
    const hasAccessPremium = await noteMonetization.checkNoteAccess(premiumNoteId, user2.address);
    console.log("User2 has access to premium note (before purchase):", hasAccessPremium);
    
    // Test 4: Purchase premium note access
    console.log("\n=== Test 4: Purchase Premium Note Access ===");
    
    // First, user2 needs to approve spending
    console.log("User2 approving token spending...");
    const approveTx = await moduloToken.connect(user2).approve(noteMonetization.address, accessPrice);
    await approveTx.wait();
    
    console.log("User2 purchasing access to premium note...");
    const purchaseTx = await noteMonetization.connect(user2).purchaseNoteAccess(premiumNoteId);
    await purchaseTx.wait();
    
    // Check access after purchase
    const hasAccessAfterPurchase = await noteMonetization.checkNoteAccess(premiumNoteId, user2.address);
    console.log("User2 has access to premium note (after purchase):", hasAccessAfterPurchase);
    
    // Check balances after purchase
    console.log("User2 MODO balance after purchase:", hre.ethers.utils.formatEther(await moduloToken.balanceOf(user2.address)));
    
    // Check earnings
    const user1Earnings = await noteMonetization.userEarnings(user1.address);
    console.log("User1 earnings:", hre.ethers.utils.formatEther(user1Earnings));
    
    // Test 5: Get note details
    console.log("\n=== Test 5: Note Details ===");
    const noteDetails = await noteMonetization.getNoteDetails(premiumNoteId);
    console.log("Premium note details:");
    console.log("  Owner:", noteDetails[0]);
    console.log("  Title:", noteDetails[3]);
    console.log("  Is Premium:", noteDetails[5]);
    console.log("  Access Price:", hre.ethers.utils.formatEther(noteDetails[6]), "MODO");
    console.log("  Total Earnings:", hre.ethers.utils.formatEther(noteDetails[7]), "MODO");
    console.log("  Access Count:", noteDetails[8].toString());
    console.log("  Category:", noteDetails[9]);
    console.log("  Description:", noteDetails[10]);
    
    // Test 6: Withdraw earnings
    console.log("\n=== Test 6: Withdraw Earnings ===");
    const balanceBeforeWithdraw = await moduloToken.balanceOf(user1.address);
    console.log("User1 MODO balance before withdrawal:", hre.ethers.utils.formatEther(balanceBeforeWithdraw));
    
    console.log("User1 withdrawing earnings...");
    const withdrawTx = await noteMonetization.connect(user1).withdrawEarnings(0); // 0 = withdraw all
    await withdrawTx.wait();
    
    const balanceAfterWithdraw = await moduloToken.balanceOf(user1.address);
    console.log("User1 MODO balance after withdrawal:", hre.ethers.utils.formatEther(balanceAfterWithdraw));
    
    // Test 7: Update note price
    console.log("\n=== Test 7: Update Note Price ===");
    const newPrice = hre.ethers.utils.parseEther("3"); // 3 MODO tokens
    
    console.log("User1 updating note price...");
    const updatePriceTx = await noteMonetization.connect(user1).updateNotePrice(premiumNoteId, newPrice);
    await updatePriceTx.wait();
    
    const updatedDetails = await noteMonetization.getNoteDetails(premiumNoteId);
    console.log("Updated access price:", hre.ethers.utils.formatEther(updatedDetails[6]), "MODO");
    
    // Final summary
    console.log("\n=== Final Summary ===");
    console.log("Total notes registered:", (await noteMonetization.noteCount()).toString());
    console.log("Total purchases:", (await noteMonetization.totalPurchases()).toString());
    console.log("ModuloToken total supply:", hre.ethers.utils.formatEther(await moduloToken.totalSupply()));
    
    const finalBalances = {
        owner: hre.ethers.utils.formatEther(await moduloToken.balanceOf(owner.address)),
        user1: hre.ethers.utils.formatEther(await moduloToken.balanceOf(user1.address)),
        user2: hre.ethers.utils.formatEther(await moduloToken.balanceOf(user2.address)),
        contract: hre.ethers.utils.formatEther(await moduloToken.balanceOf(noteMonetization.address))
    };
    
    console.log("Final MODO balances:");
    console.log("  Owner:", finalBalances.owner);
    console.log("  User1:", finalBalances.user1);
    console.log("  User2:", finalBalances.user2);
    console.log("  Contract:", finalBalances.contract);
    
    console.log("\n🎉 All tests completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Test failed:", error);
        process.exit(1);
    });
