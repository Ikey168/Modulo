import React, { useState, useEffect } from 'react';
import { useBlockchain, useBlockchainNotes } from './BlockchainContext';

interface BlockchainVerificationProps {
  noteContent: string;
  onVerificationComplete?: (verified: boolean, details: any) => void;
}

export const BlockchainVerification: React.FC<BlockchainVerificationProps> = ({
  noteContent,
  onVerificationComplete
}) => {
  const { isConnected, account, error } = useBlockchain();
  const { verifyNote, generateNoteHash } = useBlockchainNotes();
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    if (noteContent && isConnected) {
      handleVerification();
    }
  }, [noteContent, isConnected]);

  const handleVerification = async () => {
    if (!noteContent || !isConnected) return;

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const result = await verifyNote(noteContent);
      setVerificationResult(result);
      onVerificationComplete?.(result.exists, result);
    } catch (err: any) {
      setVerificationError(err.message);
      onVerificationComplete?.(false, null);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="blockchain-verification bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="w-5 h-5 text-yellow-600">⚠️</div>
          <span className="ml-2 text-yellow-800">
            Connect your wallet to verify note integrity on blockchain
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="blockchain-verification bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="w-5 h-5 text-red-600">❌</div>
          <span className="ml-2 text-red-800">
            Blockchain Error: {error}
          </span>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="blockchain-verification bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="w-5 h-5 text-blue-600 animate-spin">⟳</div>
          <span className="ml-2 text-blue-800">
            Verifying note on blockchain...
          </span>
        </div>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="blockchain-verification bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="w-5 h-5 text-red-600">❌</div>
          <span className="ml-2 text-red-800">
            Verification failed: {verificationError}
          </span>
        </div>
        <button
          onClick={handleVerification}
          className="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
        >
          Retry verification
        </button>
      </div>
    );
  }

  if (verificationResult) {
    const { exists, isOwner, isActive } = verificationResult;
    const noteHash = generateNoteHash(noteContent);

    if (exists && isActive) {
      return (
        <div className="blockchain-verification bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <div className="w-5 h-5 text-green-600">✅</div>
            <span className="ml-2 text-green-800 font-medium">
              Note verified on blockchain
            </span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Hash: <span className="font-mono text-xs break-all">{noteHash}</span></div>
            <div>Owner: {isOwner ? 'You' : 'Another user'}</div>
            <div>Status: Active</div>
            <div>Account: <span className="font-mono text-xs">{account}</span></div>
          </div>
        </div>
      );
    } else if (exists && !isActive) {
      return (
        <div className="blockchain-verification bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <div className="w-5 h-5 text-orange-600">⚠️</div>
            <span className="ml-2 text-orange-800 font-medium">
              Note exists but is deactivated
            </span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Hash: <span className="font-mono text-xs break-all">{noteHash}</span></div>
            <div>Owner: {isOwner ? 'You' : 'Another user'}</div>
            <div>Status: Deactivated</div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="blockchain-verification bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <div className="w-5 h-5 text-gray-600">ℹ️</div>
            <span className="ml-2 text-gray-800 font-medium">
              Note not found on blockchain
            </span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Hash: <span className="font-mono text-xs break-all">{noteHash}</span></div>
            <div>This note has not been registered on the blockchain</div>
          </div>
        </div>
      );
    }
  }

  return null;
};

interface BlockchainConnectButtonProps {
  className?: string;
}

export const BlockchainConnectButton: React.FC<BlockchainConnectButtonProps> = ({
  className = ''
}) => {
  const { isConnected, isInitializing, account, initialize } = useBlockchain();

  if (isConnected && account) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <span className="text-sm text-gray-700">
          Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={initialize}
      disabled={isInitializing}
      className={`
        px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
        disabled:opacity-50 disabled:cursor-not-allowed transition-colors
        ${className}
      `}
    >
      {isInitializing ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

interface BlockchainRegistrationProps {
  noteContent: string;
  noteTitle: string;
  onRegistrationComplete?: (success: boolean, details: any) => void;
}

export const BlockchainRegistration: React.FC<BlockchainRegistrationProps> = ({
  noteContent,
  noteTitle,
  onRegistrationComplete
}) => {
  const { isConnected } = useBlockchain();
  const { registerNote, verifyNote } = useBlockchainNotes();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<any>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);

  useEffect(() => {
    checkIfExists();
  }, [noteContent, isConnected]);

  const checkIfExists = async () => {
    if (!noteContent || !isConnected) return;

    try {
      const result = await verifyNote(noteContent);
      setAlreadyExists(result.exists);
    } catch (err) {
      console.error('Error checking note existence:', err);
    }
  };

  const handleRegistration = async () => {
    if (!noteContent || !noteTitle || !isConnected) return;

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const result = await registerNote(noteContent, noteTitle);
      setRegistrationResult(result);
      onRegistrationComplete?.(true, result);
    } catch (err: any) {
      setRegistrationError(err.message);
      onRegistrationComplete?.(false, null);
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="blockchain-registration bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="text-yellow-800">
          Connect your wallet to register this note on the blockchain
        </div>
      </div>
    );
  }

  if (alreadyExists) {
    return (
      <div className="blockchain-registration bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="w-5 h-5 text-orange-600">⚠️</div>
          <span className="ml-2 text-orange-800">
            This note is already registered on the blockchain
          </span>
        </div>
      </div>
    );
  }

  if (registrationResult) {
    return (
      <div className="blockchain-registration bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <div className="w-5 h-5 text-green-600">✅</div>
          <span className="ml-2 text-green-800 font-medium">
            Note registered successfully!
          </span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Note ID: {registrationResult.noteId}</div>
          <div>Transaction: 
            <a 
              href={`https://etherscan.io/tx/${registrationResult.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-blue-600 hover:text-blue-800 underline font-mono text-xs"
            >
              {registrationResult.txHash.substring(0, 10)}...
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (registrationError) {
    return (
      <div className="blockchain-registration bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <div className="w-5 h-5 text-red-600">❌</div>
          <span className="ml-2 text-red-800 font-medium">
            Registration failed
          </span>
        </div>
        <div className="text-sm text-gray-600 mb-3">{registrationError}</div>
        <button
          onClick={handleRegistration}
          className="text-blue-600 hover:text-blue-800 underline text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="blockchain-registration bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-blue-800 font-medium">Register on Blockchain</div>
          <div className="text-sm text-blue-600">
            Secure this note with immutable blockchain verification
          </div>
        </div>
        <button
          onClick={handleRegistration}
          disabled={isRegistering}
          className="
            px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors
          "
        >
          {isRegistering ? 'Registering...' : 'Register Note'}
        </button>
      </div>
    </div>
  );
};
