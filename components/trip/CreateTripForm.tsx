'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function CreateTripForm() {
  const router = useRouter();
  const [tripName, setTripName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tripName.trim()) {
      setError('Please enter a trip name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: tripName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create trip');
      }

      const data = (await response.json()) as {
        trip: { id: string };
        tokens: { editToken: string };
      };
      router.push(`/trip/${data.tokens.editToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Input
          type="text"
          placeholder="Enter trip name (e.g., Japan 2026)"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          disabled={isLoading}
          autoFocus
          className="text-lg h-14"
        />
        {error && (
          <p className="text-sm text-red-600 mt-2" role="alert">
            {error}
          </p>
        )}
      </div>
      
      <Button
        type="submit"
        disabled={isLoading || !tripName.trim()}
        className="w-full h-14 text-lg font-semibold"
        size="lg"
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-3" />
            Creating...
          </>
        ) : (
          'Create Trip'
        )}
      </Button>
    </form>
  );
}
