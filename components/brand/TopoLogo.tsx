import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function TopoLogo({
  className,
  title = 'Daily Dally',
  ...props
}: HTMLAttributes<SVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={cn('h-9 w-9', className)}
      {...props}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="ddTopoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F5F0E6" />
          <stop offset="1" stopColor="#E8E0D0" />
        </linearGradient>
        <linearGradient id="ddTopoStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2D5A45" />
          <stop offset="1" stopColor="#C4704B" />
        </linearGradient>
      </defs>

      {/* Badge */}
      <rect x="3" y="3" width="42" height="42" rx="12" fill="url(#ddTopoBg)" />
      <rect x="3" y="3" width="42" height="42" rx="12" fill="none" stroke="#D4C9B8" />

      {/* Topographic contour lines */}
      <g fill="none" stroke="url(#ddTopoStroke)" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M10 18c4-6 12-8 18-4 4 3 7 3 10-1"
          strokeWidth="1.8"
          opacity="0.95"
        />
        <path
          d="M9 25c5-4 11-5 16-2 5 3 10 3 14-1"
          strokeWidth="1.6"
          opacity="0.9"
        />
        <path
          d="M11 32c4-3 9-4 13-2 5 2 9 2 13-1"
          strokeWidth="1.4"
          opacity="0.85"
        />

        {/* Small “summit” ring */}
        <path
          d="M30.5 20.5c2.8-1.2 5.2-.7 6.8 1.2 1.8 2.2 1.6 5.3-.6 7.1-2 1.7-5 1.7-7.1-.1-2.3-2-2.2-5.8.9-8.2Z"
          strokeWidth="1.3"
          opacity="0.9"
        />
      </g>

      {/* Accent pin dot */}
      <circle cx="15.5" cy="28.5" r="1.7" fill="#2D5A45" opacity="0.9" />
      <circle cx="15.5" cy="28.5" r="3.2" fill="none" stroke="#C4704B" strokeWidth="1" opacity="0.55" />
    </svg>
  );
}

