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
    <div className={`app-layout ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''}`}>
      <Header />
      {!isMobile && <Navbar />}
      <main className={`main-content ${isMobile ? 'mobile-main' : ''}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;