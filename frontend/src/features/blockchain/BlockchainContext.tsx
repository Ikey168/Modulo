import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { blockchainService, Note, NoteVerification } from '../../services/blockchain';

interface BlockchainContextType {
  // Connection state
  isConnected: boolean;
  isInitializing: boolean;
  account: string | null;
  error: string | null;
  
  // Actions
  initialize: () => Promise<boolean>;
  disconnect: () => void;
  
  // Note operations
  registerNote: (content: string, title: string) => Promise<{ noteId: number; txHash: string }>;
  verifyNote: (content: string) => Promise<NoteVerification>;
  getNote: (noteId: number) => Promise<Note>;
  getNoteByHash: (content: string) => Promise<Note>;
  getMyNotes: () => Promise<number[]>;
  getMyActiveNoteCount: () => Promise<number>;
  updateNote: (noteId: number, newContent: string) => Promise<string>;
  deactivateNote: (noteId: number) => Promise<string>;
  transferNoteOwnership: (noteId: number, newOwner: string) => Promise<string>;
  getTotalNoteCount: () => Promise<number>;
  
  // Utilities
  generateNoteHash: (content: string) => string;
}

const BlockchainContext = createContext<BlockchainContextType | undefined>(undefined);

interface BlockchainProviderProps {
  children: ReactNode;
}

export const BlockchainProvider: React.FC<BlockchainProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialize = async (): Promise<boolean> => {
    if (isInitializing) return false;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      const success = await blockchainService.init();
      
      if (success) {
        const accountAddress = await blockchainService.getAccount();
        setAccount(accountAddress);
        setIsConnected(true);
        
        // Listen for account changes
        if (window.ethereum) {
          window.ethereum.on('accountsChanged', handleAccountsChanged);
          window.ethereum.on('chainChanged', handleChainChanged);
        }
        
        console.log('Blockchain connection established');
      } else {
        setError('Failed to connect to blockchain');
      }
      
      return success;
    } catch (err: any) {
      console.error('Blockchain initialization error:', err);
      setError(err.message || 'Failed to initialize blockchain connection');
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setAccount(null);
    setError(null);
    
    // Remove event listeners
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
    
    console.log('Blockchain connection disconnected');
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnect();
    } else {
      setAccount(accounts[0]);
      // Re-initialize if account changed
      if (isConnected) {
        await initialize();
      }
    }
  };

  const handleChainChanged = (_chainId: string) => {
    // Reload the page when chain changes to ensure proper initialization
    window.location.reload();
  };

  // Wrap blockchain service methods with error handling
  const wrapAsyncMethod = <T extends any[], R>(
    method: (...args: T) => Promise<R>
  ) => {
    return async (...args: T): Promise<R> => {
      try {
        if (!isConnected) {
          throw new Error('Blockchain not connected. Please connect your wallet first.');
        }
        
        setError(null);
        return await method(...args);
      } catch (err: any) {
        const errorMessage = err.message || 'An unknown error occurred';
        setError(errorMessage);
        console.error('Blockchain operation failed:', err);
        throw err;
      }
    };
  };

  const contextValue: BlockchainContextType = {
    // Connection state
    isConnected,
    isInitializing,
    account,
    error,
    
    // Actions
    initialize,
    disconnect,
    
    // Note operations (wrapped with error handling)
    registerNote: wrapAsyncMethod(blockchainService.registerNote.bind(blockchainService)),
    verifyNote: wrapAsyncMethod(blockchainService.verifyNote.bind(blockchainService)),
    getNote: wrapAsyncMethod(blockchainService.getNote.bind(blockchainService)),
    getNoteByHash: wrapAsyncMethod(blockchainService.getNoteByHash.bind(blockchainService)),
    getMyNotes: wrapAsyncMethod(blockchainService.getMyNotes.bind(blockchainService)),
    getMyActiveNoteCount: wrapAsyncMethod(blockchainService.getMyActiveNoteCount.bind(blockchainService)),
    updateNote: wrapAsyncMethod(blockchainService.updateNote.bind(blockchainService)),
    deactivateNote: wrapAsyncMethod(blockchainService.deactivateNote.bind(blockchainService)),
    transferNoteOwnership: wrapAsyncMethod(blockchainService.transferNoteOwnership.bind(blockchainService)),
    getTotalNoteCount: wrapAsyncMethod(blockchainService.getTotalNoteCount.bind(blockchainService)),
    
    // Utilities
    generateNoteHash: blockchainService.generateNoteHash.bind(blockchainService),
  };

  // Auto-initialize if MetaMask is available
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window.ethereum !== 'undefined' && window.ethereum.isConnected?.()) {
        // Check if we have permission to access accounts
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            await initialize();
          }
        } catch (err) {
          console.log('Auto-connect failed:', err);
        }
      }
    };

    autoConnect();
  }, []);

  return (
    <BlockchainContext.Provider value={contextValue}>
      {children}
    </BlockchainContext.Provider>
  );
};

export const useBlockchain = (): BlockchainContextType => {
  const context = useContext(BlockchainContext);
  if (context === undefined) {
    throw new Error('useBlockchain must be used within a BlockchainProvider');
  }
  return context;
};

// Helper hook for blockchain connection status
export const useBlockchainConnection = () => {
  const { isConnected, isInitializing, account, error, initialize } = useBlockchain();
  
  return {
    isConnected,
    isInitializing,
    account,
    error,
    connect: initialize
  };
};

// Helper hook for note operations
export const useBlockchainNotes = () => {
  const blockchain = useBlockchain();
  
  return {
    registerNote: blockchain.registerNote,
    verifyNote: blockchain.verifyNote,
    getNote: blockchain.getNote,
    getNoteByHash: blockchain.getNoteByHash,
    getMyNotes: blockchain.getMyNotes,
    getMyActiveNoteCount: blockchain.getMyActiveNoteCount,
    updateNote: blockchain.updateNote,
    deactivateNote: blockchain.deactivateNote,
    transferNoteOwnership: blockchain.transferNoteOwnership,
    getTotalNoteCount: blockchain.getTotalNoteCount,
    generateNoteHash: blockchain.generateNoteHash
  };
};
