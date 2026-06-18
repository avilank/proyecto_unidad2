import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { SwrProvider } from '@/presentation/providers/SwrProvider';
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
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-bg font-sans antialiased">
        <SwrProvider>{children}</SwrProvider>
      </body>
    </html>
  );
}
