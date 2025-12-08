import './globals.css';

export const metadata = {
  title: 'SatDoku',
  description: 'Sudoku game with Lightning payments',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

