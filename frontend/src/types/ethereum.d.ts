// Ethereum provider type declarations for MetaMask and other Web3 wallets

export interface EthereumProvider {
  isMetaMask?: boolean;
  isConnected(): boolean;
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(event: string, callback: (...args: any[]) => void): void;
  removeListener(event: string, callback: (...args: any[]) => void): void;
  selectedAddress?: string;
  chainId?: string;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
