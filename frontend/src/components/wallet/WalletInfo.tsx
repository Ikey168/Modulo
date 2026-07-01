import React, { useState } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { Copy } from 'lucide-react';
import { Card, Button, Label, Separator, Spinner, cn } from '@/ui';

interface WalletInfoProps {
  className?: string;
}

const WalletInfo: React.FC<WalletInfoProps> = ({ className = '' }) => {
  const { user, refreshWalletBalance } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!user || user.authProvider !== 'metamask') {
    return null;
  }

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    try {
      await refreshWalletBalance();
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatBalance = (balance: string | undefined): string => {
    if (!balance) return '0.0000';
    const num = parseFloat(balance);
    return num.toFixed(4);
  };

  const formatAddress = (address: string | undefined): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center text-[15px] font-semibold tracking-tight text-foreground">
          <svg
            className="mr-2 h-5 w-5 text-warning"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M20.8 3.6L14.4 8.4L15.6 5.4L20.8 3.6ZM3.2 3.6L8.4 5.4L9.6 8.4L3.2 3.6ZM18.4 15.6L20.8 20.4L15.6 18.6L18.4 15.6ZM5.6 15.6L8.4 18.6L3.2 20.4L5.6 15.6ZM9.6 9.6L12 11.1L14.4 9.6L13.2 12L12 14.4L10.8 12L9.6 9.6ZM8.4 13.2L6 16.8L9.6 15.6L8.4 13.2ZM15.6 13.2L14.4 15.6L18 16.8L15.6 13.2Z" />
          </svg>
          Wallet Info
        </h3>
        <Button
          variant="link"
          size="sm"
          onClick={handleRefreshBalance}
          disabled={isRefreshing}
        >
          {isRefreshing ? <Spinner className="size-4" /> : 'Refresh'}
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="mb-1 block">
            Wallet Address
          </Label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] text-foreground">
              {formatAddress(user.walletAddress)}
            </span>
            <button
              onClick={() => copyToClipboard(user.walletAddress || '')}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              title="Copy full address"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div>
          <Label className="mb-1 block">
            Balance
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">
              {formatBalance(user.walletBalance)} ETH
            </span>
          </div>
        </div>
      </div>

      <Separator className="my-4" />
      <div className="flex items-center text-[13px] text-subtle-foreground">
        <div className="mr-2 h-2 w-2 rounded-full bg-success" />
        Connected via MetaMask
      </div>
    </Card>
  );
};

export default WalletInfo;
