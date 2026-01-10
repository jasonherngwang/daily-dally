import type { Metadata } from 'next';
import './globals.css';
import { GoogleMapsInit } from '@/components/map/GoogleMapsInit';

export const metadata: Metadata = {
  title: 'Daily Dally - Your journey, day by day',
  description: 'Plan your trips day by day with integrated maps and itineraries',
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
