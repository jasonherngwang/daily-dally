import { CreateTripForm } from '@/components/trip/CreateTripForm';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center topo-pattern px-4 py-12 sm:py-16">
      <div className="w-full max-w-lg space-y-12">
        <div className="text-center space-y-6">
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-ink leading-tight">
            Daily Dally
          </h1>
          <p className="text-xl sm:text-2xl text-ink-light font-light tracking-wide">
            Your journey, day by day
          </p>
        </div>
        
        <div className="card-elevated rounded-2xl bg-parchment-dark/80 backdrop-blur-sm border border-border/50 p-8 sm:p-10">
          <CreateTripForm />
        </div>
      </div>
    </div>
  );
}
