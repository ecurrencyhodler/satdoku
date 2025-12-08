import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'Satdoku',
  description: 'Sudoku game with Lightning payments',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

