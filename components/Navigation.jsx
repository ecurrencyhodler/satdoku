'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

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

export default function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="navigation">
      <div className="nav-links">
        <Link href="/" className={pathname === '/' ? 'nav-link active' : 'nav-link'}>
          Game
        </Link>
        <Link href="/leaderboard" className={pathname === '/leaderboard' ? 'nav-link active' : 'nav-link'}>
          Leaderboard
        </Link>
        <a 
          href="https://github.com/ecurrencyhodler" 
          target="_blank" 
          rel="noopener noreferrer"
          className={pathname === '/github' ? 'nav-link active' : 'nav-link'}
        >
          Github
        </a>
      </div>
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </nav>
  );
}
