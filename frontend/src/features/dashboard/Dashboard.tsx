import React from 'react';
import { FileText, TrendingUp, Flame, Inbox, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import WalletInfo from '../../components/wallet/WalletInfo';
import { Button, Card, EmptyState } from '@/ui';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto animate-fade-in">
        <header className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-subtle-foreground mt-1 text-sm">
                Welcome back, {user?.name || 'User'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" size="md">
                <RefreshCw />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Wallet Info for MetaMask users */}
          {user?.authProvider === 'metamask' && (
            <div className="lg:col-span-1">
              <WalletInfo />
            </div>
          )}

          {/* Dashboard cards */}
          <div className={user?.authProvider === 'metamask' ? 'lg:col-span-3' : 'lg:col-span-4'}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary [&_svg]:size-5">
                    <FileText />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-subtle-foreground">Active Contracts</h3>
                    <div className="mt-1">
                      <span className="text-3xl font-semibold tracking-tight text-foreground">0</span>
                      <p className="text-xs text-muted-foreground">Total Active</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-success/15 text-success [&_svg]:size-5">
                    <TrendingUp />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-subtle-foreground">Recent Transactions</h3>
                    <div className="mt-1">
                      <span className="text-3xl font-semibold tracking-tight text-foreground">0</span>
                      <p className="text-xs text-muted-foreground">Last 24 hours</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-warning/15 text-warning [&_svg]:size-5">
                    <Flame />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-subtle-foreground">Gas Usage</h3>
                    <div className="mt-1">
                      <span className="text-3xl font-semibold tracking-tight text-foreground">0 ETH</span>
                      <p className="text-xs text-muted-foreground">Total Used</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <Card>
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Recent Activity</h2>
          </div>
          <EmptyState
            icon={<Inbox />}
            title="No recent activity"
            description="Your transactions and contract interactions will appear here"
          />
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
