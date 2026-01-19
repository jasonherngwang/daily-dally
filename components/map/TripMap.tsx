"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Destination } from "@/types/trip";
import { darkenHex, distinctRouteColor } from "@/lib/route-colors";

export interface TripMapRoute {
  id: string; // stable id (e.g. dayId)
  label?: string;
  dayIndex?: number;
  destinations: Destination[];
  color?: string;
}

interface TripMapProps {
  // Day View (legacy): single list of destinations
  destinations?: Destination[];
  // Trip View: multiple per-day routes
  routes?: TripMapRoute[];
  activeDestinationId?: string;
  onDestinationClick?: (id: string) => void;
  onDestinationHover?: (id: string | null) => void;
  onMapClick?: () => void;
  previewLocation?: { lat: number; lng: number } | null;
}


export function TripMap({
  destinations = [],
  routes,
  activeDestinationId,
  onDestinationClick,
  onDestinationHover,
  onMapClick,
  previewLocation = null,
}: TripMapProps) {
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || null;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  type MarkerEntry = {
    destinationId: string;
    marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker;
    number: number;
    color: string;
    activeColor?: string;
  };
  const markersRef = useRef<MarkerEntry[]>([]);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(
    null
  );
  const directionsRenderersRef = useRef<Map<string, google.maps.DirectionsRenderer>>(
    new Map()
  );
  const previewMarkerRef = useRef<google.maps.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const routesKeyRef = useRef<string>("");

  const hasValidLocation = useCallback(
    (d: Destination) =>
      d.location != null &&
      Number.isFinite(d.location.lat) &&
      Number.isFinite(d.location.lng),
    []
  );

  const normalizedRoutes: Array<{
    id: string;
    label?: string;
    color: string;
    activeColor?: string;
    destinations: Destination[];
  }> = useMemo(() => {
    if (routes && routes.length > 0) {
      return routes.map((r, idx) => {
        const colorIndex = r.dayIndex ?? idx;
        const fallbackColor = distinctRouteColor(colorIndex);
        return {
          id: r.id,
          label: r.label,
          color: r.color || fallbackColor,
          destinations: r.destinations ?? [],
        };
      });
    }
    return [
      {
        id: "active-day",
        label: undefined,
        // Preserve legacy Day View styling:
        // - inactive markers: terracotta
        // - active marker: forest
        color: "#C4704B",
        activeColor: "#2D5A45",
        destinations,
      },
    ];
  }, [routes, destinations]);

  const routesKey = useMemo(() => {
    // Include route ids + order + coordinates so any route/order change triggers a refresh.
    return normalizedRoutes
      .map((r) => {
        const withLocation = r.destinations.filter(hasValidLocation);
        const coords = withLocation
          .map((d) => `${d.id}:${d.location!.lat},${d.location!.lng}`)
          .join("|");
        return `${r.id}::${coords}`;
      })
      .join("||");
  }, [normalizedRoutes, hasValidLocation]);

  const destinationsWithMeta = useMemo(() => {
    // Flatten per route; numbering is per-route (per day) and only counts items with locations.
    const out: Array<{
      destination: Destination;
      number: number;
      color: string;
      activeColor?: string;
      routeId: string;
    }> = [];
    for (const r of normalizedRoutes) {
      let counter = 0;
      for (const d of r.destinations) {
        if (!hasValidLocation(d)) continue;
        counter += 1;
        out.push({
          destination: d,
          number: counter,
          color: r.color,
          activeColor: r.activeColor,
          routeId: r.id,
        });
      }
    }
    return out;
  }, [normalizedRoutes, hasValidLocation]);

  const handleDestinationClick = useCallback(
    (id: string) => {
      if (onDestinationClick) {
        onDestinationClick(id);
      }
    },
    [onDestinationClick]
  );

  const handleDestinationHover = useCallback(
    (id: string | null) => {
      if (onDestinationHover) {
        onDestinationHover(id);
      }
    },
    [onDestinationHover]
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
        }

        // Map background click clears selection (but avoid duplicate listeners).
        if (mapInstanceRef.current && onMapClick && !mapClickListenerRef.current) {
          mapClickListenerRef.current = mapInstanceRef.current.addListener(
            "click",
            () => onMapClick()
          );
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
        markersRef.current.forEach(({ marker }) => {
          if (isLegacyMarker(marker)) marker.setMap(null);
          else marker.map = null;
        });
        markersRef.current = [];
        directionsRenderersRef.current.forEach((r) => r.setMap(null));
        directionsRenderersRef.current.clear();
        if (previewMarkerRef.current) {
          previewMarkerRef.current.setMap(null);
          previewMarkerRef.current = null;
        }
        if (mapClickListenerRef.current) {
          mapClickListenerRef.current.remove();
          mapClickListenerRef.current = null;
        }
        mapInstanceRef.current = null;
        directionsServiceRef.current = null;
      }
    };
  }, []);

  // If a destination is selected from the list, ensure it's visible on the map.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;
    if (!activeDestinationId) return;
    const d = destinationsWithMeta.find((x) => x.destination.id === activeDestinationId)?.destination;
    if (!d?.location) return;
    const latLng = new google.maps.LatLng(d.location.lat, d.location.lng);
    const bounds = map.getBounds();
    if (bounds && bounds.contains(latLng)) return;
    map.panTo(latLng);
    if ((map.getZoom() ?? 0) < 12) {
      map.setZoom(12);
    }
  }, [activeDestinationId, destinationsWithMeta, isMapReady]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && mapInstanceRef.current) {
        setTimeout(() => {
          if (mapInstanceRef.current) {
            google.maps.event.trigger(mapInstanceRef.current, "resize");
            if (markersRef.current.length > 0) {
              const bounds = new google.maps.LatLngBounds();
              markersRef.current.forEach(({ marker }) => {
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

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    if (!previewLocation) {
      if (previewMarkerRef.current) {
        previewMarkerRef.current.setMap(null);
        previewMarkerRef.current = null;
      }
      return;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24">
        <path fill="#7C3AED" stroke="#FFFFFF" stroke-width="1.5" d="M12 22s8-4.5 8-12a8 8 0 1 0-16 0c0 7.5 8 12 8 12Z"/>
        <circle cx="12" cy="10" r="3.4" fill="#FFFFFF"/>
      </svg>
    `.trim();
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    const latLng = new google.maps.LatLng(previewLocation.lat, previewLocation.lng);

    if (!previewMarkerRef.current) {
      previewMarkerRef.current = new google.maps.Marker({
        map,
        position: previewLocation,
        clickable: false,
        zIndex: 1000000,
        icon: {
          url,
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 40),
        },
      });
    } else {
      previewMarkerRef.current.setPosition(previewLocation);
      previewMarkerRef.current.setMap(map);
      previewMarkerRef.current.setZIndex(1000000);
    }

    const bounds = map.getBounds();
    if (bounds && !bounds.contains(latLng)) {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const next = new google.maps.LatLngBounds(sw, ne);
      next.extend(latLng);
      map.fitBounds(next, 80);
    }
  }, [previewLocation, isMapReady]);

  function ensureDirectionsRenderer(routeId: string, strokeColor: string) {
    if (!mapInstanceRef.current) return null;
    const existing = directionsRenderersRef.current.get(routeId);
    if (existing) {
      existing.setOptions({
        polylineOptions: {
          strokeColor,
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
      });
      return existing;
    }
    const renderer = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor,
        strokeWeight: 4,
        strokeOpacity: 0.8,
      },
    });
    directionsRenderersRef.current.set(routeId, renderer);
    return renderer;
  }

  function removeDirectionsRenderer(routeId: string) {
    const existing = directionsRenderersRef.current.get(routeId);
    if (!existing) return;
    existing.setMap(null);
    directionsRenderersRef.current.delete(routeId);
  }

  function requestDirections(routeId: string, dests: Destination[], strokeColor: string) {
    if (!directionsServiceRef.current) return;
    const renderer = ensureDirectionsRenderer(routeId, strokeColor);
    if (!renderer) return;

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
          renderer
        ) {
          renderer.setDirections(result);
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

      if (destinationsWithMeta.length === 0) {
        markersRef.current.forEach(({ marker }) => {
          if (isLegacyMarker(marker)) marker.setMap(null);
          else marker.map = null;
        });
        markersRef.current = [];
        directionsRenderersRef.current.forEach((r) => r.setMap(null));
        directionsRenderersRef.current.clear();
        return;
      }

      const currentKey = routesKey;
      if (
        routesKeyRef.current === currentKey &&
        markersRef.current.length === destinationsWithMeta.length
      ) {
        // Still ensure directions are in sync (cheap, and avoids stale polylines).
        for (const r of normalizedRoutes) {
          const withLoc = r.destinations.filter(hasValidLocation);
          if (withLoc.length >= 2) {
            requestDirections(r.id, withLoc, r.color);
          } else {
            removeDirectionsRenderer(r.id);
          }
        }
        return;
      }

      routesKeyRef.current = currentKey;

      markersRef.current.forEach(({ marker }) => {
        if (isLegacyMarker(marker)) marker.setMap(null);
        else marker.map = null;
      });
      markersRef.current = [];

      // Remove renderers for routes that no longer exist.
      const routeIds = new Set(normalizedRoutes.map((r) => r.id));
      directionsRenderersRef.current.forEach((renderer, routeId) => {
        if (!routeIds.has(routeId)) {
          renderer.setMap(null);
          directionsRenderersRef.current.delete(routeId);
        }
      });

      const markerEntries: MarkerEntry[] = [];
      const advanced = mapId
        ? ((await importLibrary("marker")) as unknown as {
            AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
          })
        : null;

      destinationsWithMeta.forEach((entry) => {
        const destination = entry.destination;
        const isActive = destination.id === activeDestinationId;
        const position = {
          lat: destination.location!.lat,
          lng: destination.location!.lng,
        };
        const zIndex = isActive ? 1_000_000 : entry.number + 1;
        const baseColor = entry.color;
        const activeColor = entry.activeColor;

        let marker:
          | google.maps.marker.AdvancedMarkerElement
          | google.maps.Marker;

        if (advanced) {
          marker = new advanced.AdvancedMarkerElement({
            position,
            map: mapInstanceRef.current!,
            title: destination.name,
            content: createCustomMarkerContent(entry.number, baseColor, isActive, activeColor),
            zIndex,
          });

          // Advanced markers fire `gmp-click` instead of `click`.
          marker.addListener("gmp-click", () => {
            handleDestinationClick(destination.id);
          });

          // Best-effort hover events (varies by environment).
          marker.addListener("gmp-mouseover", () => handleDestinationHover(destination.id));
          marker.addListener("gmp-mouseout", () => handleDestinationHover(null));
        } else {
          // Fallback: keep the app working even without a Map ID.
          // (This will still show the deprecation warning until a Map ID is configured.)
          marker = new google.maps.Marker({
            position,
            map: mapInstanceRef.current!,
            title: destination.name,
            icon: createCustomMarkerIcon(entry.number, baseColor, isActive, activeColor),
            zIndex,
            label: {
              text: String(entry.number),
              color: "white",
              fontSize: "14px",
              fontWeight: "bold",
            },
          });

          marker.addListener("click", () => {
            handleDestinationClick(destination.id);
          });
          marker.addListener("mouseover", () => handleDestinationHover(destination.id));
          marker.addListener("mouseout", () => handleDestinationHover(null));
        }

        markerEntries.push({
          destinationId: destination.id,
          marker,
          number: entry.number,
          color: baseColor,
          activeColor,
        });
      });

      markersRef.current = markerEntries;

      if (markerEntries.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markerEntries.forEach(({ marker }) => {
          const pos = getMarkerPosition(marker);
          if (!pos) return;
          bounds.extend(pos);
        });
        mapInstanceRef.current.fitBounds(bounds, 50);
      }

      for (const r of normalizedRoutes) {
        const withLoc = r.destinations.filter(hasValidLocation);
        if (withLoc.length >= 2) {
          requestDirections(r.id, withLoc, r.color);
        } else {
          removeDirectionsRenderer(r.id);
        }
      }
    };

    updateMarkers();
  }, [
    isMapReady,
    routesKey,
    destinationsWithMeta,
    normalizedRoutes,
    activeDestinationId,
    handleDestinationClick,
    hasValidLocation,
  ]);

  useEffect(() => {
    if (!mapInstanceRef.current || markersRef.current.length === 0) return;

    markersRef.current.forEach((entry) => {
      const isActive = entry.destinationId === activeDestinationId;
      const zIndex = isActive ? 1_000_000 : entry.number + 1;
      if (isLegacyMarker(entry.marker)) {
        entry.marker.setIcon(
          createCustomMarkerIcon(entry.number, entry.color, isActive, entry.activeColor)
        );
        entry.marker.setZIndex(zIndex);
      } else {
        entry.marker.content = createCustomMarkerContent(
          entry.number,
          entry.color,
          isActive,
          entry.activeColor
        );
        entry.marker.zIndex = zIndex;
      }
    });
  }, [activeDestinationId]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-border/50 bg-parchment-dark/50 card-elevated">
        <p className="text-ink-light text-center px-6 text-base">
          Failed to load map. Please try refreshing.
        </p>
      </div>
    );
  }

  const showEmptyState = destinationsWithMeta.length === 0;
  const showLegend = (routes?.length ?? 0) > 0;

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden border border-border/50 card-elevated">
      {showLegend && (
        <div className="absolute left-3 top-3 z-20 max-w-[70%] rounded-xl border border-border/70 bg-parchment/80 backdrop-blur-md px-3 py-2">
          <div className="text-[11px] font-semibold text-ink-light uppercase tracking-wide">
            Routes
          </div>
          <div className="mt-1 space-y-1">
            {normalizedRoutes.map((r, idx) => (
              <div key={r.id} className="flex items-center gap-2 text-xs text-ink">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border border-white/70"
                  style={{ backgroundColor: r.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">
                  {r.label || `Day ${idx + 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  baseColor: string,
  isActive: boolean,
  activeColor?: string
): HTMLElement {
  const size = isActive ? 44 : 36;
  const color = isActive ? activeColor || darkenHex(baseColor, 0.12) : baseColor;

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
  baseColor: string,
  isActive: boolean,
  activeColor?: string
): google.maps.Icon {
  const size = isActive ? 44 : 36;
  const color = isActive ? activeColor || darkenHex(baseColor, 0.12) : baseColor;

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
