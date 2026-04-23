import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Nav from '@/components/ui/Nav';
import Footer from '@/components/ui/Footer';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SALCI — Strikeout Adjusted Lineup Confidence Index',
  description: 'MLB pitching analytics and strikeout prop predictions powered by Statcast data.',
  applicationName: 'SALCI',
  keywords: ['MLB', 'baseball', 'strikeouts', 'analytics', 'pitcher props', 'Statcast'],
  openGraph: {
    title: 'SALCI — MLB Strikeout Analytics',
    description: 'Statcast-powered pitcher strikeout predictions.',
    siteName: 'SALCI',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <Nav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 md:pb-6">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
