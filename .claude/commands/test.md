Run Modulo test suites. $ARGUMENTS can be: "frontend", "backend", "contracts", or empty to run all.

## Frontend (Vitest)
```
cd /home/Ikey/Modulo/frontend && npx vitest run
```

## Backend (Maven/JUnit)
```
cd /home/Ikey/Modulo/backend && mvn test
```

## Smart contracts (Hardhat)
```
cd /home/Ikey/Modulo/smart-contracts && npx hardhat test
```

Run only the tier(s) matching $ARGUMENTS, or all three if no argument given.

After all selected tiers complete, print a summary table:
| Tier       | Result | Tests passed | Tests failed |
|------------|--------|-------------|--------------|
| Frontend   | ...    | ...         | ...          |
| Backend    | ...    | ...         | ...          |
| Contracts  | ...    | ...         | ...          |

Call out any failures with their test names. If $ARGUMENTS is "coverage", add `--coverage` to the vitest command and `npx hardhat coverage` instead of `npx hardhat test`.
