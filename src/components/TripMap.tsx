import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { type DayPlan } from "@/data/demoTrip";
import { getMapboxToken, MAPBOX_STYLES } from "@/lib/mapbox";
import { MapLayerSwitcher } from "@/components/MapLayerSwitcher";

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

// Icon SVG paths for marker categories
const TAG_ICONS: Record<string, string> = {
  "Food & Drink": "M16 2l-5.1 5.1M2 16l5.1-5.1M14.5 7.5l-8 8M8.5 2.5l7 7M2.5 8.5l7 7M22 2L12 12",
  "Hiking & Nature": "M8 3l4 8 5-5 5 15H2L8 3z",
  "History & Culture": "M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2L2 8h20L12 2z",
  default: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};

function getIconSvg(tags: string[]): string {
  const tagStr = tags.join(" ").toLowerCase();
  const foodWords = ["food", "drink", "restaurant", "eat", "cafe", "coffee", "bar"];
  const natureWords = ["hik", "nature", "trail", "mountain", "park", "outdoor"];
  const cultureWords = ["histor", "culture", "museum", "landmark", "temple"];
  if (foodWords.some(w => tagStr.includes(w))) return TAG_ICONS["Food & Drink"];
  if (natureWords.some(w => tagStr.includes(w))) return TAG_ICONS["Hiking & Nature"];
  if (cultureWords.some(w => tagStr.includes(w))) return TAG_ICONS["History & Culture"];
  return TAG_ICONS.default;
}

export function TripMap({ itinerary, highlightedStop, onHighlightStop, focusedDay, onResetFocus, onStopClick, visible = true }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: { marker: mapboxgl.Marker; el: HTMLDivElement } }>({});
  const [activeStyle, setActiveStyle] = useState("outdoors");
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    let cancelled = false;

    getMapboxToken().then((token) => {
      if (cancelled || !mapRef.current) return;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapRef.current!,
        style: MAPBOX_STYLES[0].url,
        center: [-98.35, 39.5],
        zoom: 4,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

      map.on("load", () => {
        if (!cancelled) {
          mapInstance.current = map;
          setMapReady(true);
          // Enable terrain if available
          if (map.getStyle().sources?.["mapbox-dem"] === undefined) {
            map.addSource("mapbox-dem", {
              type: "raster-dem",
              url: "mapbox://mapbox.mapbox-terrain-dem-v1",
              tileSize: 512,
              maxzoom: 14,
            });
          }
        }
      });
    });

    return () => {
      cancelled = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
      setMapReady(false);
    };
  }, []);

  // Handle style change
  const handleStyleChange = (styleUrl: string, styleId: string) => {
    const map = mapInstance.current;
    if (!map) return;
    setActiveStyle(styleId);

    // Preserve current position
    const center = map.getCenter();
    const zoom = map.getZoom();
    const pitch = map.getPitch();
    const bearing = map.getBearing();

    map.setStyle(styleUrl);
    map.once("style.load", () => {
      map.setCenter(center);
      map.setZoom(zoom);
      map.setPitch(pitch);
      map.setBearing(bearing);
      // Re-add terrain source
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      // Enable 3D terrain for terrain/outdoors styles
      if (styleId === "terrain" || styleId === "outdoors") {
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      } else {
        map.setTerrain(null);
      }
      // Re-add route and markers
      addRouteAndMarkers();
    });
  };

  // Build markers & route
  const addRouteAndMarkers = () => {
    const map = mapInstance.current;
    if (!map || !itinerary) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
    markersRef.current = {};

    // Remove old route layer/source
    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getLayer("route-line-dashed")) map.removeLayer("route-line-dashed");
    if (map.getSource("route")) map.removeSource("route");

    const coords: [number, number][] = [];

    itinerary.forEach((day, dayIdx) => {
      const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
      day.stops.forEach((stop) => {
        coords.push([stop.lng, stop.lat]);

        // Create custom marker element
        const el = document.createElement("div");
        el.className = "mapbox-custom-marker";
        el.style.cursor = "pointer";
        el.style.transition = "transform 0.2s ease";
        el.style.zIndex = "10";

        const iconPaths = getIconSvg(stop.tags);

        el.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div class="marker-pill" style="
              display:flex;align-items:center;gap:6px;
              background:white;border:2px solid transparent;border-radius:20px;
              padding:4px 10px 4px 6px;
              box-shadow:0 2px 8px rgba(0,0,0,0.18);
              white-space:nowrap;font-family:'Plus Jakarta Sans',sans-serif;max-width:180px;
            ">
              <div style="
                width:24px;height:24px;border-radius:50%;background:${color};
                display:flex;align-items:center;justify-content:center;flex-shrink:0;
              ">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  ${iconPaths.split("M").filter(Boolean).map(p => `<path d="M${p}"/>`).join("")}
                </svg>
              </div>
              <span style="font-size:12px;font-weight:600;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;line-height:1.2;">${stop.name}</span>
            </div>
            <div style="width:2px;height:10px;background:${color};"></div>
            <div style="width:8px;height:8px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
          </div>
        `;

        el.addEventListener("mouseenter", () => onHighlightStop(stop.id));
        el.addEventListener("mouseleave", () => onHighlightStop(null));
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onStopClick?.(stop.name, stop.lat, stop.lng);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);

        markersRef.current[stop.id] = { marker, el };
      });
    });

    // Route polyline
    if (coords.length > 1) {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#1B4332",
          "line-width": 3,
          "line-opacity": 0.5,
          "line-dasharray": [2, 2],
        },
      });
    }

    // Fit bounds
    fitBounds(coords);
  };

  const fitBounds = (coords: [number, number][], padding = 60) => {
    const map = mapInstance.current;
    if (!map || coords.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, { padding, maxZoom: 14, duration: 800 });
  };

  // Build markers when itinerary or map is ready
  useEffect(() => {
    if (mapReady && itinerary) addRouteAndMarkers();
  }, [itinerary, mapReady]);

  // Zoom to focused day (only when explicitly focusing a day)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !itinerary || !mapReady) return;

    if (focusedDay !== null) {
      const day = itinerary.find((d) => d.day === focusedDay);
      if (day && day.stops.length > 0) {
        const coords: [number, number][] = day.stops.map((s) => [s.lng, s.lat]);
        fitBounds(coords, 80);
      }
    }
    // Don't reset view when focusedDay becomes null
  }, [focusedDay, mapReady]);

  // Resize on visibility change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !visible) return;
    setTimeout(() => map.resize(), 100);
  }, [visible]);

  // Highlight markers
  useEffect(() => {
    if (!itinerary) return;
    itinerary.forEach((day, dayIdx) => {
      const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
      day.stops.forEach((stop) => {
        const ref = markersRef.current[stop.id];
        if (!ref) return;
        const isHighlighted = highlightedStop === stop.id;
        const pill = ref.el.querySelector(".marker-pill") as HTMLElement;
        if (pill) {
          pill.style.borderColor = isHighlighted ? color : "transparent";
          pill.style.boxShadow = isHighlighted ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.18)";
        }
        ref.el.style.zIndex = isHighlighted ? "100" : "10";
        ref.el.style.transform = isHighlighted ? "scale(1.1)" : "scale(1)";
      });
    });
  }, [highlightedStop, itinerary]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      <MapLayerSwitcher activeStyle={activeStyle} onStyleChange={handleStyleChange} />
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
