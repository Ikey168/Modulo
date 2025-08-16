import React, { useState } from 'react';
import { useAuth } from '../../features/auth/useAuth';

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
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <svg
            className="w-5 h-5 mr-2 text-orange-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M20.8 3.6L14.4 8.4L15.6 5.4L20.8 3.6ZM3.2 3.6L8.4 5.4L9.6 8.4L3.2 3.6ZM18.4 15.6L20.8 20.4L15.6 18.6L18.4 15.6ZM5.6 15.6L8.4 18.6L3.2 20.4L5.6 15.6ZM9.6 9.6L12 11.1L14.4 9.6L13.2 12L12 14.4L10.8 12L9.6 9.6ZM8.4 13.2L6 16.8L9.6 15.6L8.4 13.2ZM15.6 13.2L14.4 15.6L18 16.8L15.6 13.2Z" />
          </svg>
          Wallet Info
        </h3>
        <button
          onClick={handleRefreshBalance}
          disabled={isRefreshing}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshing ? (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            'Refresh'
          )}
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wallet Address
          </label>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-900 font-mono">
              {formatAddress(user.walletAddress)}
            </span>
            <button
              onClick={() => copyToClipboard(user.walletAddress || '')}
              className="text-gray-500 hover:text-gray-700"
              title="Copy full address"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Balance
          </label>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-semibold text-gray-900">
              {formatBalance(user.walletBalance)} ETH
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center text-sm text-gray-600">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          Connected via MetaMask
        </div>
      </div>
    </div>
  );
};

export default WalletInfo;
