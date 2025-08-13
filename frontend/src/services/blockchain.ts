import { ethers } from 'ethers';

// Contract ABI - This will be generated after compilation
const CONTRACT_ABI = [
  // Events
  "event NoteRegistered(address indexed owner, uint256 indexed noteId, bytes32 indexed hash, string title, uint256 timestamp)",
  "event NoteUpdated(address indexed owner, uint256 indexed noteId, bytes32 indexed newHash, uint256 timestamp)",
  "event NoteDeactivated(address indexed owner, uint256 indexed noteId, uint256 timestamp)",
  "event OwnershipTransferred(uint256 indexed noteId, address indexed previousOwner, address indexed newOwner)",
  
  // Read functions
  "function verifyNote(bytes32 hash) view returns (bool exists, bool isOwner, bool isActive)",
  "function getNote(uint256 noteId) view returns (tuple(address owner, bytes32 hash, uint256 timestamp, string title, bool isActive))",
  "function getNoteByHash(bytes32 hash) view returns (tuple(address owner, bytes32 hash, uint256 timestamp, string title, bool isActive))",
  "function getNotesByOwner(address owner) view returns (uint256[])",
  "function getActiveNoteCount(address owner) view returns (uint256)",
  "function isNoteOwner(uint256 noteId, address owner) view returns (bool)",
  "function getTotalNoteCount() view returns (uint256)",
  "function isOwner(uint256 noteId) view returns (bool)",
  
  // Write functions
  "function registerNote(bytes32 hash, string title) returns (uint256)",
  "function updateNote(uint256 noteId, bytes32 newHash)",
  "function deactivateNote(uint256 noteId)",
  "function transferOwnership(uint256 noteId, address newOwner)"
];

// Contract configuration
const CONTRACT_CONFIG = {
  // These will be updated after deployment
  addresses: {
    localhost: "0x...", // Local development
    sepolia: "0x...",   // Sepolia testnet
    mumbai: "0x...",    // Polygon Mumbai testnet
    polygon: "0x...",   // Polygon mainnet
    mainnet: "0x..."    // Ethereum mainnet
  }
};

export interface Note {
  owner: string;
  hash: string;
  timestamp: number;
  title: string;
  isActive: boolean;
}

export interface NoteVerification {
  exists: boolean;
  isOwner: boolean;
  isActive: boolean;
}

export class BlockchainService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress: string = '';

  /**
   * Initialize the blockchain service
   */
  async init(): Promise<boolean> {
    try {
      // Check if MetaMask is available
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not detected. Please install MetaMask to use blockchain features.');
      }

      // Initialize provider
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Get network and contract address
      const network = await this.provider.getNetwork();
      this.contractAddress = this.getContractAddress(network.chainId);
      
      if (!this.contractAddress) {
        throw new Error(`Contract not deployed on network ${network.name} (chainId: ${network.chainId})`);
      }

      // Request account access
      await this.provider.send('eth_requestAccounts', []);
      this.signer = this.provider.getSigner();

      // Initialize contract
      this.contract = new ethers.Contract(
        this.contractAddress,
        CONTRACT_ABI,
        this.signer
      );

      console.log('Blockchain service initialized successfully');
      console.log(`Network: ${network.name} (${network.chainId})`);
      console.log(`Contract: ${this.contractAddress}`);
      console.log(`Account: ${await this.signer.getAddress()}`);

      return true;
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
      return false;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return !!(this.provider && this.signer && this.contract);
  }

  /**
   * Get the current account address
   */
  async getAccount(): Promise<string> {
    if (!this.signer) throw new Error('Blockchain service not initialized');
    return await this.signer.getAddress();
  }

  /**
   * Get contract address for the current network
   */
  private getContractAddress(chainId: number): string {
    switch (chainId) {
      case 1337: // Local
      case 31337: // Hardhat
        return CONTRACT_CONFIG.addresses.localhost;
      case 11155111: // Sepolia
        return CONTRACT_CONFIG.addresses.sepolia;
      case 80001: // Mumbai
        return CONTRACT_CONFIG.addresses.mumbai;
      case 137: // Polygon
        return CONTRACT_CONFIG.addresses.polygon;
      case 1: // Mainnet
        return CONTRACT_CONFIG.addresses.mainnet;
      default:
        return '';
    }
  }

  /**
   * Generate hash for note content
   */
  generateNoteHash(content: string): string {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(content));
  }

  /**
   * Register a new note on the blockchain
   */
  async registerNote(noteContent: string, title: string): Promise<{ noteId: number; txHash: string }> {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    try {
      const hash = this.generateNoteHash(noteContent);
      
      // Check if note already exists
      const verification = await this.verifyNote(hash);
      if (verification.exists) {
        throw new Error('Note with this content already exists on the blockchain');
      }

      console.log('Registering note on blockchain...');
      const tx = await this.contract.registerNote(hash, title);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`Note registered in block: ${receipt.blockNumber}`);
      
      // Extract note ID from event
      const event = receipt.events?.find((e: any) => e.event === 'NoteRegistered');
      const noteId = event?.args?.noteId?.toNumber() || 0;
      
      return {
        noteId,
        txHash: tx.hash
      };
    } catch (error: any) {
      console.error('Failed to register note:', error);
      throw new Error(`Failed to register note: ${error.message}`);
    }
  }

  /**
   * Verify a note on the blockchain
   */
  async verifyNote(hashOrContent: string): Promise<NoteVerification> {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    try {
      // If it's not a hash, generate one
      const hash = hashOrContent.startsWith('0x') ? hashOrContent : this.generateNoteHash(hashOrContent);
      
      const [exists, isOwner, isActive] = await this.contract.verifyNote(hash);
      
      return {
        exists,
        isOwner,
        isActive
      };
    } catch (error: any) {
      console.error('Failed to verify note:', error);
      throw new Error(`Failed to verify note: ${error.message}`);
    }
  }

  /**
   * Get note details by ID
   */
  async getNote(noteId: number): Promise<Note> {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    try {
      const note = await this.contract.getNote(noteId);
      
      return {
        owner: note.owner,
        hash: note.hash,
        timestamp: note.timestamp.toNumber(),
        title: note.title,
        isActive: note.isActive
      };
    } catch (error: any) {
      console.error('Failed to get note:', error);
      throw new Error(`Failed to get note: ${error.message}`);
    }
  }

  /**
   * Get note details by hash
   */
  async getNoteByHash(hashOrContent: string): Promise<Note> {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    try {
      const hash = hashOrContent.startsWith('0x') ? hashOrContent : this.generateNoteHash(hashOrContent);
      const note = await this.contract.getNoteByHash(hash);
      
      return {
        owner: note.owner,
        hash: note.hash,
        timestamp: note.timestamp.toNumber(),
        title: note.title,
        isActive: note.isActive
      };
    } catch (error: any) {
      console.error('Failed to get note by hash:', error);
      throw new Error(`Failed to get note by hash: ${error.message}`);
    }
  }

  /**
   * Get all notes owned by current user
   */
  async getMyNotes(): Promise<number[]> {
    if (!this.contract || !this.signer) throw new Error('Blockchain service not initialized');
    
    try {
      const account = await this.signer.getAddress();
      const noteIds = await this.contract.getNotesByOwner(account);
      
      return noteIds.map((id: ethers.BigNumber) => id.toNumber());
    } catch (error: any) {
      console.error('Failed to get user notes:', error);
      throw new Error(`Failed to get user notes: ${error.message}`);
    }
  }

  /**
   * Get active note count for current user
   */
  async getMyActiveNoteCount(): Promise<number> {
    if (!this.contract || !this.signer) throw new Error('Blockchain service not initialized');
    
    try {
      const account = await this.signer.getAddress();
      const count = await this.contract.getActiveNoteCount(account);
      
      return count.toNumber();
    } catch (error: any) {
      console.error('Failed to get active note count:', error);
      throw new Error(`Failed to get active note count: ${error.message}`);
    }
  }

  /**
   * Update a note's content
   */
  async updateNote(noteId: number, newContent: string): Promise<string> {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    try {
      const newHash = this.generateNoteHash(newContent);
      
      console.log('Updating note on blockchain...');
      const tx = await this.contract.updateNote(noteId, newHash);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      await tx.wait();
      console.log('Note updated successfully');
      
      return tx.hash;
    } catch (error: any) {
      console.error('Failed to update note:', error);
      throw new Error(`Failed to update note: ${error.message}`);
    }
  }

  /**
   * Deactivate a note
   */
  async deactivateNote(noteId: number): Promise<string> {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    try {
      console.log('Deactivating note on blockchain...');
      const tx = await this.contract.deactivateNote(noteId);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      await tx.wait();
      console.log('Note deactivated successfully');
      
      return tx.hash;
    } catch (error: any) {
      console.error('Failed to deactivate note:', error);
      throw new Error(`Failed to deactivate note: ${error.message}`);
    }
  }

  /**
   * Transfer note ownership
   */
  async transferNoteOwnership(noteId: number, newOwner: string): Promise<string> {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    try {
      // Validate Ethereum address
      if (!ethers.utils.isAddress(newOwner)) {
        throw new Error('Invalid Ethereum address');
      }

      console.log('Transferring note ownership on blockchain...');
      const tx = await this.contract.transferOwnership(noteId, newOwner);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      await tx.wait();
      console.log('Note ownership transferred successfully');
      
      return tx.hash;
    } catch (error: any) {
      console.error('Failed to transfer note ownership:', error);
      throw new Error(`Failed to transfer note ownership: ${error.message}`);
    }
  }

  /**
   * Listen for contract events
   */
  subscribeToEvents(callback: (event: any) => void): () => void {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    const filters = [
      this.contract.filters.NoteRegistered(),
      this.contract.filters.NoteUpdated(),
      this.contract.filters.NoteDeactivated(),
      this.contract.filters.OwnershipTransferred()
    ];

    filters.forEach(filter => {
      this.contract!.on(filter, callback);
    });

    // Return cleanup function
    return () => {
      filters.forEach(filter => {
        this.contract!.off(filter, callback);
      });
    };
  }

  /**
   * Get total number of notes in the system
   */
  async getTotalNoteCount(): Promise<number> {
    if (!this.contract) throw new Error('Blockchain service not initialized');
    
    try {
      const count = await this.contract.getTotalNoteCount();
      return count.toNumber();
    } catch (error: any) {
      console.error('Failed to get total note count:', error);
      throw new Error(`Failed to get total note count: ${error.message}`);
    }
  }
}

// Create singleton instance
export const blockchainService = new BlockchainService();
