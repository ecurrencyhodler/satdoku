import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import Navigation from '../components/Navigation';
import { ThemeProvider } from '../components/ThemeProvider';

export const metadata = {
  title: 'Satdoku',
  description: 'Sudoku game with Lightning payments',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const savedTheme = localStorage.getItem('theme');
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <Navigation />
          <div className="main-content">
            {children}
          </div>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}

