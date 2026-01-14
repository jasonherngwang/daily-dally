import { CreateTripForm } from '@/components/trip/CreateTripForm';
import Link from 'next/link';
import { TopoLogo } from '@/components/brand/TopoLogo';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center topo-pattern px-4 py-12 sm:py-16">
      <div className="w-full max-w-lg space-y-12">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <Link
              href="/"
              className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
              aria-label="Home"
              title="Daily Dally"
            >
              <TopoLogo className="h-12 w-12 sm:h-14 sm:w-14" />
            </Link>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-ink leading-tight">
            Daily Dally
          </h1>
          <p className="text-xl sm:text-2xl text-ink-light font-light tracking-wide">
            Plan a trip with a daily itinerary and map
          </p>
        </div>
        
        <div className="card-elevated rounded-2xl bg-parchment-dark/80 backdrop-blur-sm border border-border/50 p-8 sm:p-10">
          <CreateTripForm />
        </div>
      </div>
    </div>
  );
}
