import { useEffect, useRef, useCallback } from "react";
import { type DayPlan } from "@/data/demoTrip";
import { loadGoogleMaps } from "@/lib/google-maps";

interface TripMapProps {
  itinerary: DayPlan[] | null;
  highlightedStop: string | null;
  onHighlightStop: (stopId: string | null) => void;
  focusedDay: number | null;
  onResetFocus: () => void;
  onStopClick?: (name: string, lat: number, lng: number) => void;
  visible?: boolean;
}

const DAY_COLORS = ["#1B4332", "#2563EB", "#F4A261", "#D6336C", "#6D28D9", "#0D9488", "#EAB308"];

export function TripMap({ itinerary, highlightedStop, onHighlightStop, focusedDay, onResetFocus, onStopClick, visible = true }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const polylineRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    loadGoogleMaps().then(() => {
      if (!mapRef.current) return;
      const gm = (window as any).google.maps;
      mapInstance.current = new gm.Map(mapRef.current, {
        center: { lat: 39.5, lng: -98.35 },
        zoom: 5,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: gm.ControlPosition.TOP_RIGHT },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "water", stylers: [{ color: "#c9e8f5" }] },
          { featureType: "landscape", stylers: [{ color: "#f0f4e8" }] },
        ],
      });
    });

    return () => {
      mapInstance.current = null;
    };
  }, []);

  // Build markers & polyline
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !itinerary) return;
    const gm = (window as any).google.maps;

    // Clear old
    Object.values(markersRef.current).forEach((m: any) => m.setMap(null));
    markersRef.current = {};
    if (polylineRef.current) polylineRef.current.setMap(null);

    const bounds = new gm.LatLngBounds();
    const path: any[] = [];
    let stopNum = 1;

    itinerary.forEach((day, dayIdx) => {
      const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
      day.stops.forEach(stop => {
        const pos = { lat: stop.lat, lng: stop.lng };
        bounds.extend(pos);
        path.push(pos);

        const marker = new gm.Marker({
          position: pos,
          map,
          icon: buildIcon(stopNum, color, false),
          title: stop.name,
          zIndex: 10,
        });

        marker.addListener("mouseover", () => onHighlightStop(stop.id));
        marker.addListener("mouseout", () => onHighlightStop(null));

        // Click opens destination panel instead of info window
        marker.addListener("click", () => {
          onStopClick?.(stop.name, stop.lat, stop.lng);
        });

        markersRef.current[stop.id] = marker;
        stopNum++;
      });
    });

    // Route polyline
    if (path.length > 1) {
      polylineRef.current = new gm.Polyline({
        path,
        strokeColor: "#1B4332",
        strokeWeight: 3,
        strokeOpacity: 0.6,
        geodesic: true,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "16px" }],
      });
      polylineRef.current.setMap(map);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
  }, [itinerary, onHighlightStop]);

  // Zoom to focused day
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !itinerary) return;
    const gm = (window as any).google.maps;

    if (focusedDay !== null) {
      const day = itinerary.find(d => d.day === focusedDay);
      if (day && day.stops.length > 0) {
        const bounds = new gm.LatLngBounds();
        day.stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      }
    } else {
      // Reset to full bounds
      const bounds = new gm.LatLngBounds();
      itinerary.forEach(day => day.stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng })));
      if (!bounds.isEmpty()) map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
  }, [focusedDay, itinerary]);

  // Resize map when it becomes visible (mobile toggle)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !visible) return;
    const gm = (window as any).google.maps;

    // Trigger resize so Google Maps recalculates container size
    setTimeout(() => {
      gm.event.trigger(map, "resize");
      if (itinerary) {
        if (focusedDay !== null) {
          const day = itinerary.find(d => d.day === focusedDay);
          if (day && day.stops.length > 0) {
            const bounds = new gm.LatLngBounds();
            day.stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng }));
            map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
          }
        } else {
          const bounds = new gm.LatLngBounds();
          itinerary.forEach(day => day.stops.forEach(stop => bounds.extend({ lat: stop.lat, lng: stop.lng })));
          if (!bounds.isEmpty()) map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
        }
      }
    }, 100);
  }, [visible, itinerary, focusedDay]);

  // Highlight
  useEffect(() => {
    if (!itinerary) return;
    let stopNum = 1;
    itinerary.forEach((day, dayIdx) => {
      const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
      day.stops.forEach(stop => {
        const marker = markersRef.current[stop.id];
        if (marker) {
          marker.setIcon(buildIcon(stopNum, color, highlightedStop === stop.id));
          marker.setZIndex(highlightedStop === stop.id ? 100 : 10);
        }
        stopNum++;
      });
    });
  }, [highlightedStop, itinerary]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      {itinerary && (
        <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-xl border border-border/60 px-3 py-2 shadow-md z-10">
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Days</p>
          <div className="space-y-1">
            {itinerary.map((day, i) => (
              <div key={day.day} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: DAY_COLORS[i % DAY_COLORS.length] }} />
                <span className="text-xs font-body text-foreground">Day {day.day}</span>
              </div>
            ))}
          </div>
          {focusedDay !== null && (
            <button
              onClick={onResetFocus}
              className="mt-2 text-[10px] font-body font-medium text-accent hover:underline"
            >
              ← Show all days
            </button>
          )}
        </div>
      )}
      {!itinerary && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl px-8 py-6 text-center shadow-lg border border-border/50">
            <p className="text-2xl mb-2">🗺️</p>
            <p className="font-body font-medium text-sm text-foreground">Your route will appear here</p>
            <p className="font-body text-xs text-muted-foreground mt-1">Complete the chat to see your optimized trip</p>
          </div>
        </div>
      )}
    </div>
  );
}

function buildIcon(num: number, color: string, highlighted: boolean) {
  const size = highlighted ? 36 : 28;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="${size / 2}" y="${size / 2 + 1}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Plus Jakarta Sans,sans-serif" font-weight="700" font-size="${highlighted ? 14 : 11}">${num}</text>
    </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new ((window as any).google.maps.Size)(size, size),
    anchor: new ((window as any).google.maps.Point)(size / 2, size / 2),
  };
}
