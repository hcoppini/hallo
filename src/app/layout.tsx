import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { MobileTabBar } from '@/components/MobileTabBar';
import { MobileHeader } from '@/components/MobileHeader';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cormorant',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'HALLOWEEN // NFC Bar & Guest Regulation System',
  description: 'Clean monochrome drink regulation, guest registration, and NFC management system.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PartyPass',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jakarta.variable}`}>
      <body className="antialiased min-h-dvh flex flex-col selection:bg-black selection:text-white bg-white">
        <MobileHeader />
        <div className="flex-1 pb-tabbar max-w-lg mx-auto w-full px-4 sm:px-6">
          {children}
        </div>
        <MobileTabBar />
      </body>
    </html>
  );
}
