'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useMobileDetection } from './hooks/useMobileDetection';

const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M10 2V4M10 16V18M18 10H16M4 10H2M15.657 4.343L14.243 5.757M5.757 14.243L4.343 15.657M15.657 15.657L14.243 14.243M5.757 5.757L4.343 4.343" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="crescent-mask">
        <rect width="20" height="20" fill="white"/>
        <circle cx="14" cy="6" r="6" fill="black"/>
      </mask>
    </defs>
    <circle cx="10" cy="10" r="6" fill="currentColor" mask="url(#crescent-mask)"/>
  </svg>
);

const HamburgerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMobileDetection();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const navLinks = (
    <>
      <Link href="/" className={pathname === '/' ? 'nav-link active' : 'nav-link'} onClick={closeMenu}>
        Game
      </Link>
      <a 
        href="/leaderboard" 
        target="_blank"
        rel="noopener noreferrer"
        className={pathname === '/leaderboard' ? 'nav-link active' : 'nav-link'}
        onClick={closeMenu}
      >
        Leaderboard
      </a>
      <a 
        href="https://github.com/ecurrencyhodler" 
        target="_blank" 
        rel="noopener noreferrer"
        className={pathname === '/github' ? 'nav-link active' : 'nav-link'}
        onClick={closeMenu}
      >
        Github
      </a>
      <a 
        href="https://forms.gle/wzuHjAJAVb4PJK7d9" 
        target="_blank" 
        rel="noopener noreferrer"
        className="nav-link"
        onClick={closeMenu}
      >
        Help
      </a>
    </>
  );

  return (
    <nav className="navigation">
      {isMobile ? (
        <>
          <button 
            className="hamburger-menu" 
            onClick={toggleMenu}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <div className={`mobile-menu ${isMenuOpen ? 'mobile-menu-open' : ''}`}>
            <div className="mobile-menu-content">
              {navLinks}
            </div>
            {isMenuOpen && (
              <div className="mobile-menu-overlay" onClick={closeMenu} />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="nav-links">
            {navLinks}
          </div>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </>
      )}
    </nav>
  );
}
