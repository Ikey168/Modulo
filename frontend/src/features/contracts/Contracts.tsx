import React from 'react';
import { Plus, FileCode } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, EmptyState } from '@/ui';

const Contracts: React.FC = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl animate-fade-in space-y-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Smart Contracts</h1>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="md">
              <Plus />
              Deploy New Contract
            </Button>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-subtle-foreground">Your Contracts</h2>
          <Card>
            <EmptyState
              icon={<FileCode />}
              title="No contracts deployed yet"
              action={
                <Button variant="secondary" size="sm">
                  Create Contract
                </Button>
              }
            />
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-subtle-foreground">Templates</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="transition-colors hover:bg-surface-2">
              <CardHeader>
                <CardTitle>ERC20 Token</CardTitle>
                <CardDescription>Standard token contract</CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter>
                <Button variant="outline" size="sm">Use Template</Button>
              </CardFooter>
            </Card>

            <Card className="transition-colors hover:bg-surface-2">
              <CardHeader>
                <CardTitle>ERC721 NFT</CardTitle>
                <CardDescription>Non-fungible token contract</CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter>
                <Button variant="outline" size="sm">Use Template</Button>
              </CardFooter>
            </Card>

            <Card className="transition-colors hover:bg-surface-2">
              <CardHeader>
                <CardTitle>Custom Contract</CardTitle>
                <CardDescription>Start from scratch</CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter>
                <Button variant="outline" size="sm">Create Custom</Button>
              </CardFooter>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Contracts;
