import { notFound } from 'next/navigation';
import { getTrip } from '@/lib/kv';

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);

  if (!trip) {
    notFound();
  }

  return <>{children}</>;
}
