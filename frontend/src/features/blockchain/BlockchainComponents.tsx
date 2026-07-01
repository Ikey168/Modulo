import React, { useState, useEffect } from 'react';
import { Button } from '@/ui';
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
      <div className="blockchain-verification rounded-lg border border-warning/25 bg-warning/15 p-4">
        <div className="flex items-center gap-2">
          <div className="text-warning">⚠️</div>
          <span className="text-warning">
            Connect your wallet to verify note integrity on blockchain
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="blockchain-verification rounded-lg border border-destructive/25 bg-destructive/15 p-4">
        <div className="flex items-center gap-2">
          <div className="text-destructive">❌</div>
          <span className="text-destructive">
            Blockchain Error: {error}
          </span>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="blockchain-verification rounded-lg border border-info/25 bg-info/15 p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin text-info">⟳</div>
          <span className="text-info">
            Verifying note on blockchain...
          </span>
        </div>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="blockchain-verification rounded-lg border border-destructive/25 bg-destructive/15 p-4">
        <div className="flex items-center gap-2">
          <div className="text-destructive">❌</div>
          <span className="text-destructive">
            Verification failed: {verificationError}
          </span>
        </div>
        <Button
          variant="link"
          size="sm"
          onClick={handleVerification}
          className="mt-2 text-indigo-400"
        >
          Retry verification
        </Button>
      </div>
    );
  }

  if (verificationResult) {
    const { exists, isOwner, isActive } = verificationResult;
    const noteHash = generateNoteHash(noteContent);

    if (exists && isActive) {
      return (
        <div className="blockchain-verification rounded-lg border border-success/25 bg-success/15 p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="text-success">✅</div>
            <span className="font-medium text-success">
              Note verified on blockchain
            </span>
          </div>
          <div className="space-y-1 text-sm text-subtle-foreground">
            <div>Hash: <span className="break-all font-mono text-xs">{noteHash}</span></div>
            <div>Owner: {isOwner ? 'You' : 'Another user'}</div>
            <div>Status: Active</div>
            <div>Account: <span className="font-mono text-xs">{account}</span></div>
          </div>
        </div>
      );
    } else if (exists && !isActive) {
      return (
        <div className="blockchain-verification rounded-lg border border-warning/25 bg-warning/15 p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="text-warning">⚠️</div>
            <span className="font-medium text-warning">
              Note exists but is deactivated
            </span>
          </div>
          <div className="space-y-1 text-sm text-subtle-foreground">
            <div>Hash: <span className="break-all font-mono text-xs">{noteHash}</span></div>
            <div>Owner: {isOwner ? 'You' : 'Another user'}</div>
            <div>Status: Deactivated</div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="blockchain-verification rounded-lg border border-border bg-surface-2 p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="text-muted-foreground">ℹ️</div>
            <span className="font-medium text-foreground">
              Note not found on blockchain
            </span>
          </div>
          <div className="space-y-1 text-sm text-subtle-foreground">
            <div>Hash: <span className="break-all font-mono text-xs">{noteHash}</span></div>
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
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-3 w-3 rounded-full bg-success"></div>
        <span className="text-sm text-subtle-foreground">
          Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}
        </span>
      </div>
    );
  }

  return (
    <Button
      onClick={initialize}
      disabled={isInitializing}
      loading={isInitializing}
      className={className}
    >
      {isInitializing ? 'Connecting...' : 'Connect Wallet'}
    </Button>
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
      <div className="blockchain-registration rounded-lg border border-warning/25 bg-warning/15 p-4">
        <div className="text-warning">
          Connect your wallet to register this note on the blockchain
        </div>
      </div>
    );
  }

  if (alreadyExists) {
    return (
      <div className="blockchain-registration rounded-lg border border-warning/25 bg-warning/15 p-4">
        <div className="flex items-center gap-2">
          <div className="text-warning">⚠️</div>
          <span className="text-warning">
            This note is already registered on the blockchain
          </span>
        </div>
      </div>
    );
  }

  if (registrationResult) {
    return (
      <div className="blockchain-registration rounded-lg border border-success/25 bg-success/15 p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="text-success">✅</div>
          <span className="font-medium text-success">
            Note registered successfully!
          </span>
        </div>
        <div className="space-y-1 text-sm text-subtle-foreground">
          <div>Note ID: {registrationResult.noteId}</div>
          <div>Transaction:
            <a
              href={`https://etherscan.io/tx/${registrationResult.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 font-mono text-xs text-indigo-400 underline hover:text-primary"
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
      <div className="blockchain-registration rounded-lg border border-destructive/25 bg-destructive/15 p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="text-destructive">❌</div>
          <span className="font-medium text-destructive">
            Registration failed
          </span>
        </div>
        <div className="mb-3 text-sm text-subtle-foreground">{registrationError}</div>
        <Button
          variant="link"
          size="sm"
          onClick={handleRegistration}
          className="text-indigo-400"
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="blockchain-registration rounded-lg border border-info/25 bg-info/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">Register on Blockchain</div>
          <div className="text-sm text-subtle-foreground">
            Secure this note with immutable blockchain verification
          </div>
        </div>
        <Button
          onClick={handleRegistration}
          disabled={isRegistering}
          loading={isRegistering}
        >
          {isRegistering ? 'Registering...' : 'Register Note'}
        </Button>
      </div>
    </div>
  );
};
