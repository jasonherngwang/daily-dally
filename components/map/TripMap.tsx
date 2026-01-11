"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Destination } from "@/types/trip";

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
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || null;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<
    (google.maps.marker.AdvancedMarkerElement | google.maps.Marker)[]
  >([]);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(
    null
  );
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const destinationsKeyRef = useRef<string>("");

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
    return withLocation
      .map((d) => `${d.id}:${d.location!.lat},${d.location!.lng}`)
      .join("|");
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

        const mapsLibrary = await importLibrary("maps");
        const routesLibrary = await importLibrary("routes");
        const { Map } = mapsLibrary;
        const { DirectionsService, DirectionsRenderer } = routesLibrary;

        if (!mapRef.current) return;

        if (!mapInstanceRef.current) {
          // Advanced markers require a valid `mapId`. When present, we prefer Cloud-based map styling.
          // If you don't have a mapId configured, we fall back to legacy markers (and legacy JS styling).
          const map = new Map(mapRef.current, {
            zoom: 2,
            center: { lat: 34.05194778797753, lng: -118.23827426856208 },
            ...(mapId ? { mapId } : { styles: getMapStyles() }),
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
              strokeColor: "#2D5A45",
              strokeWeight: 4,
              strokeOpacity: 0.8,
            },
          });
        }

        setIsMapReady(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing map:", error);
        setLoadError(
          error instanceof Error ? error : new Error("Failed to load map")
        );
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        markersRef.current.forEach((marker) => {
          if (isLegacyMarker(marker)) {
            marker.setMap(null);
          } else {
            marker.map = null;
          }
        });
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
      if (document.visibilityState === "visible" && mapInstanceRef.current) {
        setTimeout(() => {
          if (mapInstanceRef.current) {
            google.maps.event.trigger(mapInstanceRef.current, "resize");
            if (markersRef.current.length > 0) {
              const bounds = new google.maps.LatLngBounds();
              markersRef.current.forEach((marker) => {
                const pos = getMarkerPosition(marker);
                if (!pos) return;
                bounds.extend(pos);
              });
              mapInstanceRef.current.fitBounds(bounds, 50);
            }
          }
        }, 100);
      }
    };

    const handleResize = () => {
      if (mapInstanceRef.current) {
        google.maps.event.trigger(mapInstanceRef.current, "resize");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
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
          google.maps.event.trigger(mapInstanceRef.current, "resize");
        }
      }, 100);

      if (destinationsWithLocation.length === 0) {
        markersRef.current.forEach((marker) => {
          if (isLegacyMarker(marker)) {
            marker.setMap(null);
          } else {
            marker.map = null;
          }
        });
        markersRef.current = [];
        if (directionsRendererRef.current) {
          directionsRendererRef.current.setMap(null);
          directionsRendererRef.current.setMap(mapInstanceRef.current);
        }
        return;
      }

      const currentKey = destinationsKey;
      if (
        destinationsKeyRef.current === currentKey &&
        markersRef.current.length === destinationsWithLocation.length
      ) {
        // Still ensure directions are in sync (cheap, and avoids stale polylines).
        if (
          destinationsWithLocation.length >= 2 &&
          directionsServiceRef.current &&
          directionsRendererRef.current
        ) {
          requestDirections(destinationsWithLocation);
        }
        return;
      }

      destinationsKeyRef.current = currentKey;

      markersRef.current.forEach((marker) => {
        if (isLegacyMarker(marker)) {
          marker.setMap(null);
        } else {
          marker.map = null;
        }
      });
      markersRef.current = [];

      if (directionsRendererRef.current && mapInstanceRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current.setMap(mapInstanceRef.current);
      }

      const markers: (
        | google.maps.marker.AdvancedMarkerElement
        | google.maps.Marker
      )[] = [];
      const advanced = mapId
        ? ((await importLibrary("marker")) as unknown as {
            AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
          })
        : null;

      destinationsWithLocation.forEach((destination, index) => {
        if (!destination.location) return;

        const isActive = destination.id === activeDestinationId;
        const position = {
          lat: destination.location.lat,
          lng: destination.location.lng,
        };

        let marker:
          | google.maps.marker.AdvancedMarkerElement
          | google.maps.Marker;

        if (advanced) {
          marker = new advanced.AdvancedMarkerElement({
            position,
            map: mapInstanceRef.current!,
            title: destination.name,
            content: createCustomMarkerContent(index + 1, isActive),
          });

          // Advanced markers fire `gmp-click` instead of `click`.
          marker.addListener("gmp-click", () => {
            handleDestinationClick(destination.id);
          });
        } else {
          // Fallback: keep the app working even without a Map ID.
          // (This will still show the deprecation warning until a Map ID is configured.)
          marker = new google.maps.Marker({
            position,
            map: mapInstanceRef.current!,
            title: destination.name,
            icon: createCustomMarkerIcon(index + 1, isActive),
            label: {
              text: String(index + 1),
              color: "white",
              fontSize: "14px",
              fontWeight: "bold",
            },
          });

          marker.addListener("click", () => {
            handleDestinationClick(destination.id);
          });
        }

        markers.push(marker);
      });

      markersRef.current = markers;

      if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach((marker) => {
          const pos = getMarkerPosition(marker);
          if (!pos) return;
          bounds.extend(pos);
        });
        mapInstanceRef.current.fitBounds(bounds, 50);
      }

      if (
        destinationsWithLocation.length >= 2 &&
        directionsServiceRef.current &&
        directionsRendererRef.current
      ) {
        requestDirections(destinationsWithLocation);
      }
    };

    updateMarkers();
  }, [
    isMapReady,
    destinationsKey,
    destinationsWithLocation,
    destinations.length,
    activeDestinationId,
    handleDestinationClick,
  ]);

  useEffect(() => {
    if (!mapInstanceRef.current || markersRef.current.length === 0) return;

    markersRef.current.forEach((marker, index) => {
      const destination = destinationsWithLocation[index];
      if (!destination) return;

      const isActive = destination.id === activeDestinationId;
      if (isLegacyMarker(marker)) {
        marker.setIcon(createCustomMarkerIcon(index + 1, isActive));
      } else {
        marker.content = createCustomMarkerContent(index + 1, isActive);
      }
    });
  }, [activeDestinationId, destinationsWithLocation]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-border/50 bg-parchment-dark/50 card-elevated">
        <p className="text-ink-light text-center px-6 text-base">
          Failed to load map. Please try refreshing.
        </p>
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

function createCustomMarkerContent(
  number: number,
  isActive: boolean
): HTMLElement {
  const size = isActive ? 40 : 36;
  const color = "#C4704B";

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${
    size / 2 - 2
  }" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="${size / 2}" y="${
    size / 2
  }" text-anchor="middle" dominant-baseline="central" fill="white" font-size="14" font-weight="bold">${number}</text>
  </svg>`;

  const wrapper = document.createElement("div");
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  wrapper.style.transform = "translate(-50%, -50%)";
  wrapper.innerHTML = svg;
  return wrapper;
}

function createCustomMarkerIcon(
  number: number,
  isActive: boolean
): google.maps.Icon {
  const size = isActive ? 40 : 36;
  const color = "#C4704B";

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${
    size / 2 - 2
  }" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="${size / 2}" y="${
    size / 2
  }" text-anchor="middle" dominant-baseline="central" fill="white" font-size="14" font-weight="bold">${number}</text>
  </svg>`;

  const encodedSvg = encodeURIComponent(svg);

  return {
    url: `data:image/svg+xml,${encodedSvg}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function isLegacyMarker(
  marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker
): marker is google.maps.Marker {
  return typeof (marker as google.maps.Marker).getPosition === "function";
}

function getMarkerPosition(
  marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker
): google.maps.LatLng | null {
  if (isLegacyMarker(marker)) {
    return marker.getPosition() ?? null;
  }
  const pos = marker.position;
  if (!pos) return null;
  if (typeof (pos as google.maps.LatLng).lat === "function") {
    return pos as google.maps.LatLng;
  }
  return new google.maps.LatLng(
    (pos as google.maps.LatLngLiteral).lat,
    (pos as google.maps.LatLngLiteral).lng
  );
}

function getMapStyles(): google.maps.MapTypeStyle[] {
  return [
    {
      featureType: "all",
      elementType: "geometry",
      stylers: [{ color: "#E8E0D0" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#B8D4CE" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#FFFFFF" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#D4C9B8" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#C8D9C0" }],
    },
    {
      featureType: "administrative",
      elementType: "labels.text.fill",
      stylers: [{ color: "#5C5040" }],
    },
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "transit",
      stylers: [{ visibility: "off" }],
    },
  ];
}
