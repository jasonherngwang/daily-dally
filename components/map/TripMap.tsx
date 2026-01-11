'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Destination } from '@/types/trip';

interface TripMapProps {
  destinations: Destination[];
  activeDestinationId?: string;
  onDestinationClick?: (id: string) => void;
}

export function TripMap({
  destinations,
  activeDestinationId,
  onDestinationClick,
}: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const destinationsKeyRef = useRef<string>('');

  const hasValidLocation = useCallback(
    (d: Destination) =>
      d.location != null &&
      Number.isFinite(d.location.lat) &&
      Number.isFinite(d.location.lng),
    []
  );

  const destinationsKey = useMemo(() => {
    // Include order + coordinates so any route/order change triggers a refresh.
    const withLocation = destinations.filter(hasValidLocation);
    return withLocation.map((d) => `${d.id}:${d.location!.lat},${d.location!.lng}`).join('|');
  }, [destinations, hasValidLocation]);

  const destinationsWithLocation = useMemo(
    () => destinations.filter(hasValidLocation),
    [destinations, hasValidLocation]
  );

  const handleDestinationClick = useCallback(
    (id: string) => {
      if (onDestinationClick) {
        onDestinationClick(id);
      }
    },
    [onDestinationClick]
  );

  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const mapsLibrary = await importLibrary('maps');
        const routesLibrary = await importLibrary('routes');
        const { Map } = mapsLibrary;
        const { DirectionsService, DirectionsRenderer } = routesLibrary;

        if (!mapRef.current) return;

        if (!mapInstanceRef.current) {
          const map = new Map(mapRef.current, {
            zoom: 2,
            center: { lat: 37.7749, lng: -122.4194 },
            styles: getMapStyles(),
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });

          mapInstanceRef.current = map;
          directionsServiceRef.current = new DirectionsService();
          directionsRendererRef.current = new DirectionsRenderer({
            map,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#2D5A45',
              strokeWeight: 4,
              strokeOpacity: 0.8,
            },
          });
        }

        setIsMapReady(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing map:', error);
        setLoadError(error instanceof Error ? error : new Error('Failed to load map'));
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        if (directionsRendererRef.current) {
          directionsRendererRef.current.setMap(null);
        }
        mapInstanceRef.current = null;
        directionsServiceRef.current = null;
        directionsRendererRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mapInstanceRef.current) {
        setTimeout(() => {
          if (mapInstanceRef.current) {
            google.maps.event.trigger(mapInstanceRef.current, 'resize');
            if (markersRef.current.length > 0) {
              const bounds = new google.maps.LatLngBounds();
              markersRef.current.forEach((marker) => {
                const position = marker.getPosition();
                if (position) {
                  bounds.extend(position);
                }
              });
              mapInstanceRef.current.fitBounds(bounds, 50);
            }
          }
        }, 100);
      }
    };

    const handleResize = () => {
      if (mapInstanceRef.current) {
        google.maps.event.trigger(mapInstanceRef.current, 'resize');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  function requestDirections(dests: Destination[]) {
    if (!directionsServiceRef.current || !directionsRendererRef.current) return;

    const waypoints = dests.slice(1, -1).map((d) => ({
      location: new google.maps.LatLng(d.location!.lat, d.location!.lng),
      stopover: true,
    }));

    const origin = new google.maps.LatLng(
      dests[0].location!.lat,
      dests[0].location!.lng
    );
    const destination = new google.maps.LatLng(
      dests[dests.length - 1].location!.lat,
      dests[dests.length - 1].location!.lng
    );

    directionsServiceRef.current.route(
      {
        origin,
        destination,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (
          status === google.maps.DirectionsStatus.OK &&
          directionsRendererRef.current
        ) {
          directionsRendererRef.current.setDirections(result);
        }
      }
    );
  }

  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) {
      return;
    }

    const updateMarkers = async () => {
      if (!mapInstanceRef.current) return;

      setTimeout(() => {
        if (mapInstanceRef.current) {
          google.maps.event.trigger(mapInstanceRef.current, 'resize');
        }
      }, 100);

      if (destinationsWithLocation.length === 0) {
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        if (directionsRendererRef.current) {
          directionsRendererRef.current.setMap(null);
          directionsRendererRef.current.setMap(mapInstanceRef.current);
        }
        return;
      }

      const currentKey = destinationsKey;
      if (destinationsKeyRef.current === currentKey && markersRef.current.length === destinationsWithLocation.length) {
        // Still ensure directions are in sync (cheap, and avoids stale polylines).
        if (destinationsWithLocation.length >= 2 && directionsServiceRef.current && directionsRendererRef.current) {
          requestDirections(destinationsWithLocation);
        }
        return;
      }

      destinationsKeyRef.current = currentKey;

      const markerLibrary = await importLibrary('marker');
      const { Marker } = markerLibrary;

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      if (directionsRendererRef.current && mapInstanceRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current.setMap(mapInstanceRef.current);
      }

      const markers: google.maps.Marker[] = [];
      destinationsWithLocation.forEach((destination, index) => {
        if (!destination.location) return;

        const marker = new Marker({
          position: {
            lat: destination.location.lat,
            lng: destination.location.lng,
          },
          map: mapInstanceRef.current!,
          title: destination.name,
          icon: createCustomMarkerIcon(index + 1, destination.id === activeDestinationId),
          label: {
            text: String(index + 1),
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
          },
        });

        marker.addListener('click', () => {
          handleDestinationClick(destination.id);
        });

        markers.push(marker);
      });

      markersRef.current = markers;

      if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach((marker) => {
          const position = marker.getPosition();
          if (position) {
            bounds.extend(position);
          }
        });
        mapInstanceRef.current.fitBounds(bounds, 50);
      }

      if (destinationsWithLocation.length >= 2 && directionsServiceRef.current && directionsRendererRef.current) {
        requestDirections(destinationsWithLocation);
      }
    };

    updateMarkers();
  }, [isMapReady, destinationsKey, destinationsWithLocation, destinations.length, activeDestinationId, handleDestinationClick]);

  useEffect(() => {
    if (!mapInstanceRef.current || markersRef.current.length === 0) return;

    markersRef.current.forEach((marker, index) => {
      const destination = destinationsWithLocation[index];
      if (!destination) return;

      const isActive = destination.id === activeDestinationId;
      const icon = createCustomMarkerIcon(index + 1, isActive);
      marker.setIcon(icon);
    });
  }, [activeDestinationId, destinationsWithLocation]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-border/50 bg-parchment-dark/50 card-elevated">
        <p className="text-ink-light text-center px-6 text-base">Failed to load map. Please try refreshing.</p>
      </div>
    );
  }

  const showEmptyState = destinationsWithLocation.length === 0;

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden border border-border/50 card-elevated">
      {showEmptyState && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-parchment-dark/80 backdrop-blur-sm">
          <p className="text-ink-light text-center px-6 text-base">
            Add destinations with locations to see them on the map
          </p>
        </div>
      )}
      {isLoading && !isMapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-parchment-dark/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <p className="text-ink-light text-sm">Loading map...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
}

function createCustomMarkerIcon(
  number: number,
  isActive: boolean
): google.maps.Icon {
  const size = isActive ? 40 : 36;
  const color = '#C4704B';

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="14" font-weight="bold">${number}</text>
  </svg>`;

  const encodedSvg = encodeURIComponent(svg);

  return {
    url: `data:image/svg+xml,${encodedSvg}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function getMapStyles(): google.maps.MapTypeStyle[] {
  return [
    {
      featureType: 'all',
      elementType: 'geometry',
      stylers: [{ color: '#E8E0D0' }],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#B8D4CE' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#FFFFFF' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#D4C9B8' }],
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [{ color: '#C8D9C0' }],
    },
    {
      featureType: 'administrative',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#5C5040' }],
    },
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'transit',
      stylers: [{ visibility: 'off' }],
    },
  ];
}
