import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { SwrProvider } from '@/presentation/providers/SwrProvider';
import { ThemeProvider } from '@/presentation/providers/ThemeProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PredictMaint',
  description: 'Mantenimiento Predictivo Industrial',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-bg font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          themes={['light', 'dark']}
          value={{ light: '', dark: 'dark' }}
        >
          <SwrProvider>{children}</SwrProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
