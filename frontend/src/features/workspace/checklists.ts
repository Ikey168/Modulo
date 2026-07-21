// Audit methodology checklists (#362) — templates per contract type and a
// progress parser over markdown checkboxes. Progress derives purely from the
// note body, so there is no storage beyond the note itself.

export interface ChecklistSection {
  title: string;
  done: number;
  total: number;
}

export interface ChecklistProgress {
  sections: ChecklistSection[];
  done: number;
  total: number;
}

const HEADING_RE = /^#{1,6}\s+(.*)$/;
const CHECKBOX_RE = /^\s*[-*]\s+\[([ xX])\]/;

/** Progress per markdown section. Sections without checkboxes are omitted;
 *  checkboxes before the first heading group under "Checklist". */
export function parseChecklistProgress(body: string): ChecklistProgress {
  const sections: ChecklistSection[] = [];
  let current: ChecklistSection | null = null;
  let pendingTitle = 'Checklist';

  for (const line of body.split('\n')) {
    const heading = HEADING_RE.exec(line);
    if (heading) {
      pendingTitle = heading[1].trim();
      current = null;
      continue;
    }
    const box = CHECKBOX_RE.exec(line);
    if (box) {
      if (!current) {
        current = { title: pendingTitle, done: 0, total: 0 };
        sections.push(current);
      }
      current.total++;
      if (box[1] !== ' ') current.done++;
    }
  }

  const done = sections.reduce((n, s) => n + s.done, 0);
  const total = sections.reduce((n, s) => n + s.total, 0);
  return { sections, done, total };
}

export interface ChecklistTemplate {
  key: string;
  label: string;
  markdown: string;
}

/** Methodology templates, shipped with the plugin so the checklist content is
 *  versioned with it; freely editable after insertion. */
export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    key: 'erc20',
    label: 'ERC-20 token',
    markdown: `## Access control
- [ ] Owner/admin functions enumerated and justified
- [ ] Privileged role changes emit events and are two-step
- [ ] No unprotected mint/burn/pause paths

## Token semantics
- [ ] transfer/transferFrom return values and revert behaviour consistent
- [ ] approve race (front-running) considered; increase/decreaseAllowance present
- [ ] Fee-on-transfer / rebasing behaviour documented and consistent
- [ ] decimals/totalSupply invariants hold across mint/burn

## External interactions
- [ ] No reentrancy via hooks or callbacks (ERC-777 style)
- [ ] SafeERC20 used for external token calls

## Arithmetic
- [ ] No unchecked blocks with user-controlled values
- [ ] Rounding direction consistent and documented
`,
  },
  {
    key: 'erc721',
    label: 'ERC-721 / NFT',
    markdown: `## Access control
- [ ] Mint authorisation model reviewed (allowlist, signature, payment)
- [ ] Metadata/URI admin functions protected

## Token semantics
- [ ] safeTransferFrom receiver check cannot re-enter critical state
- [ ] Enumeration and balance invariants hold across mint/burn/transfer
- [ ] Royalty/fee logic consistent with marketplaces used

## Minting
- [ ] Supply cap enforced; no overflow of token ids
- [ ] Randomness/reveal scheme not predictable or front-runnable
- [ ] Refund/withdraw paths cannot be blocked

## External interactions
- [ ] onERC721Received callbacks treated as untrusted
`,
  },
  {
    key: 'proxy',
    label: 'Proxy / upgradeable',
    markdown: `## Storage
- [ ] Storage layout append-only across implementations; gap slots present
- [ ] No storage collisions between proxy and implementation
- [ ] Initializers guarded (initializer/reinitializer, no constructors used)

## Upgrade path
- [ ] Upgrade authorisation reviewed (timelock/multisig)
- [ ] Implementation cannot be initialised directly by attackers
- [ ] UUPS upgradeTo cannot brick the proxy (rollback/validation)

## Delegatecall safety
- [ ] No selfdestruct/delegatecall to user-controlled addresses
- [ ] msg.sender/msg.value semantics through the proxy reviewed
`,
  },
  {
    key: 'defi',
    label: 'DeFi protocol',
    markdown: `## Oracles & pricing
- [ ] Price sources manipulation-resistant (TWAP/medianised, not spot)
- [ ] Stale-price and sequencer-down handling present
- [ ] Decimals normalisation across assets correct

## Economic attacks
- [ ] Flash-loan attack surface analysed (donation, share inflation, first-depositor)
- [ ] Liquidation incentives cannot be gamed
- [ ] Fee/interest accrual order-of-operations reviewed

## External interactions
- [ ] Reentrancy guards on state-mutating externals; CEI followed
- [ ] Untrusted tokens handled (fee-on-transfer, reverting, non-standard)

## Access control & pausing
- [ ] Emergency pause cannot freeze user funds permanently
- [ ] Parameter-setting bounds sane (no 100% fee, no zero-address)

## Accounting
- [ ] Share/asset conversion rounds in the protocol's favour
- [ ] Invariants: sum of user balances ≤ protocol holdings
`,
  },
];
