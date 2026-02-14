import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type DayPlan } from "@/data/demoTrip";

interface TripMapProps {
  itinerary: DayPlan[] | null;
  highlightedStop: string | null;
  onHighlightStop: (stopId: string | null) => void;
}

const DAY_COLORS = ["#1B4332", "#2563EB", "#F4A261", "#D6336C", "#6D28D9", "#0D9488", "#EAB308"];

function createNumberedIcon(num: number, color: string, highlighted: boolean) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: ${highlighted ? 36 : 30}px;
      height: ${highlighted ? 36 : 30}px;
      border-radius: 50%;
      background: ${color};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 700;
      font-size: ${highlighted ? 14 : 12}px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,${highlighted ? 0.4 : 0.2});
      transition: all 0.2s ease;
      transform: scale(${highlighted ? 1.2 : 1});
    ">${num}</div>`,
    iconSize: [highlighted ? 36 : 30, highlighted ? 36 : 30],
    iconAnchor: [highlighted ? 18 : 15, highlighted ? 18 : 15],
  });
}

export function TripMap({ itinerary, highlightedStop, onHighlightStop }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([46.5, -122.2], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 18,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Add markers and route when itinerary loads
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !itinerary) return;

    // Clear existing
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    const allCoords: [number, number][] = [];
    let stopNum = 1;

    itinerary.forEach((day, dayIdx) => {
      const color = DAY_COLORS[dayIdx] || DAY_COLORS[0];
      day.stops.forEach(stop => {
        const marker = L.marker([stop.lat, stop.lng], {
          icon: createNumberedIcon(stopNum, color, false),
        })
          .addTo(map)
          .bindTooltip(stop.name, {
            className: "font-body text-xs",
            direction: "top",
            offset: [0, -18],
          });

        marker.on("mouseover", () => onHighlightStop(stop.id));
        marker.on("mouseout", () => onHighlightStop(null));

        markersRef.current[stop.id] = marker;
        allCoords.push([stop.lat, stop.lng]);
        stopNum++;
      });
    });

    // Route line
    if (allCoords.length > 1) {
      L.polyline(allCoords, {
        color: "#1B4332",
        weight: 3,
        opacity: 0.6,
        dashArray: "8 6",
      }).addTo(map);
    }

    // Fit bounds
    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords.map(c => L.latLng(c[0], c[1]))), {
        padding: [40, 40],
      });
    }
  }, [itinerary, onHighlightStop]);

  // Update highlighted marker
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !itinerary) return;

    let stopNum = 1;
    itinerary.forEach((day, dayIdx) => {
      const color = DAY_COLORS[dayIdx] || DAY_COLORS[0];
      day.stops.forEach(stop => {
        const marker = markersRef.current[stop.id];
        if (marker) {
          marker.setIcon(createNumberedIcon(stopNum, color, highlightedStop === stop.id));
        }
        stopNum++;
      });
    });
  }, [highlightedStop, itinerary]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      {/* Legend */}
      {itinerary && (
        <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-xl border border-border/60 px-3 py-2 shadow-md z-[1000]">
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Days</p>
          <div className="space-y-1">
            {itinerary.map((day, i) => (
              <div key={day.day} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: DAY_COLORS[i] }} />
                <span className="text-xs font-body text-foreground">Day {day.day}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!itinerary && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
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
