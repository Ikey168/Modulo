import React from 'react';
import Header from './Header';
import Navbar from './Navbar';
import Footer from './Footer';
import { useResponsive } from '../../hooks/useResponsive';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isMobile, isTablet } = useResponsive();

  return (
    <div className={`flex min-h-screen flex-col bg-background text-foreground ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''}`}>
      <Header />
      {!isMobile && <Navbar />}
      <main className={`mx-auto w-full max-w-7xl flex-1 px-6 py-8 ${isMobile ? 'mobile-main px-4 py-5' : ''}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
