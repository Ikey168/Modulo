import { ethers } from 'ethers';

export interface MetaMaskUser {
  walletAddress: string;
  walletBalance: string;
  chainId: number;
  networkName: string;
}

export class MetaMaskService {
  private provider: ethers.providers.Web3Provider | null = null;

  /**
   * Check if MetaMask is installed
   */
  isMetaMaskInstalled(): boolean {
    return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
  }

  /**
   * Request connection to MetaMask
   */
  async connect(): Promise<MetaMaskUser> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Initialize provider
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Get account details
      const accounts = await this.provider.listAccounts();
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your MetaMask wallet.');
      }

      const walletAddress = accounts[0];
      const balance = await this.provider.getBalance(walletAddress);
      const walletBalance = ethers.utils.formatEther(balance);
      
      // Get network information
      const network = await this.provider.getNetwork();

      return {
        walletAddress,
        walletBalance,
        chainId: network.chainId,
        networkName: network.name
      };
    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      if (error.code === 4001) {
        throw new Error('User rejected the connection request.');
      }
      throw new Error('Failed to connect to MetaMask. Please try again.');
    }
  }

  /**
   * Get current account information
   */
  async getCurrentAccount(): Promise<MetaMaskUser | null> {
    if (!this.provider) {
      return null;
    }

    try {
      const accounts = await this.provider.listAccounts();
      if (accounts.length === 0) {
        return null;
      }

      const walletAddress = accounts[0];
      const balance = await this.provider.getBalance(walletAddress);
      const walletBalance = ethers.utils.formatEther(balance);
      const network = await this.provider.getNetwork();

      return {
        walletAddress,
        walletBalance,
        chainId: network.chainId,
        networkName: network.name
      };
    } catch (error) {
      console.error('Failed to get current account:', error);
      return null;
    }
  }

  /**
   * Refresh wallet balance
   */
  async refreshBalance(walletAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('MetaMask not connected');
    }

    try {
      const balance = await this.provider.getBalance(walletAddress);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      throw new Error('Failed to refresh wallet balance');
    }
  }

  /**
   * Listen for account changes
   */
  onAccountsChanged(callback: (accounts: string[]) => void): void {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', callback);
    }
  }

  /**
   * Listen for network changes
   */
  onChainChanged(callback: (chainId: string) => void): void {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', callback);
    }
  }

  /**
   * Remove event listeners
   */
  removeListeners(): void {
    if (window.ethereum) {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
    }
  }

  /**
   * Disconnect from MetaMask
   */
  disconnect(): void {
    this.provider = null;
    this.removeListeners();
  }

  /**
   * Sign a message with MetaMask
   */
  async signMessage(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('MetaMask not connected');
    }

    try {
      const signer = this.provider.getSigner();
      return await signer.signMessage(message);
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw new Error('Failed to sign message');
    }
  }

  /**
   * Get network name from chain ID
   */
  getNetworkName(chainId: number): string {
    const networks: { [key: number]: string } = {
      1: 'Ethereum Mainnet',
      3: 'Ropsten Test Network',
      4: 'Rinkeby Test Network',
      5: 'Goerli Test Network',
      42: 'Kovan Test Network',
      137: 'Polygon Mainnet',
      80001: 'Polygon Mumbai Testnet',
      11155111: 'Sepolia Test Network',
      1337: 'Local Network'
    };
    
    return networks[chainId] || `Unknown Network (${chainId})`;
  }
}

// Create a singleton instance
export const metaMaskService = new MetaMaskService();

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
