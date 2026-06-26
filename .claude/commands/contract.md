Manage Modulo smart contracts (Hardhat/Solidity). All commands run from /home/Ikey/Modulo/smart-contracts/.

Determine action from $ARGUMENTS:

**compile** — Compile contracts:
`npx hardhat compile`

**test** (default if no argument) — Run test suite:
`npx hardhat test`

**coverage** — Test with Solidity coverage report:
`npx hardhat coverage`

**gas** — Test with gas usage report:
`REPORT_GAS=true npx hardhat test`

**deploy:local** — Deploy to local Hardhat network:
`npx hardhat run scripts/deploy.js --network localhost`

**deploy:mumbai** — Deploy to Polygon Mumbai testnet:
`npx hardhat run scripts/deploy-mumbai.js --network mumbai`
Requires MUMBAI_RPC_URL and PRIVATE_KEY env vars set.

**deploy:mainnet** — Deploy to Polygon mainnet:
WARN THE USER this is a mainnet deployment and costs real MATIC. Ask for explicit confirmation.
`npx hardhat run scripts/deploy-polygon-mainnet.js --network polygon`

**verify** — Verify deployed contracts on Polygonscan:
`npx hardhat run scripts/verify-polygon-mainnet.js --network polygon`

**audit** — Run the security scanner:
`node scripts/security-scanner.js`

If no argument or unrecognised argument, show this menu and ask which action to take.
