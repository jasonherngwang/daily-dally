import type { Metadata } from 'next';
import './globals.css';
import { GoogleMapsInit } from '@/components/map/GoogleMapsInit';

export const metadata: Metadata = {
  title: 'Daily Dally',
  description: 'Plan a trip with a daily itinerary and map',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="theme-color" content="#EFE7D9" />
      </head>
      <body>
        <GoogleMapsInit />
        {children}
      </body>
    </html>
  );
}
