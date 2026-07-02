import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <Header />
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 max-md:px-4 max-md:py-5">
      {children}
    </main>
    <Footer />
  </div>
);

export default Layout;
