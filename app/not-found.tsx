import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center topo-pattern p-4">
      <div className="text-center space-y-4">
        <h1 className="font-display text-5xl font-bold text-ink">404</h1>
        <p className="text-xl text-ink-light">Trip not found</p>
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
