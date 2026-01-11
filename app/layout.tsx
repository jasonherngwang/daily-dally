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
      <body>
        <GoogleMapsInit />
        {children}
      </body>
    </html>
  );
}
