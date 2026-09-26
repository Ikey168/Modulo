/** Keep a signature claim distinct from independent verification and anchoring. */
export const signatureLabel = (state: string) => ({
  SERVER_SIGNED: 'Server signed · not locally verified',
  WALLET_SIGNED: 'Wallet signed · not locally verified',
  UNSIGNED: 'Unsigned · unverifiable',
}[state] || 'Unverifiable signature state');
