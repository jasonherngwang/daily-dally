import { notFound } from 'next/navigation';
import { getTripAccessByToken } from '@/lib/kv';

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const access = await getTripAccessByToken(tripId);

  if (!access) {
    notFound();
  }

  return <>{children}</>;
}
