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
  onFocusDay?: (dayNumber: number) => void;
  onStopClick?: (name: string, lat: number, lng: number) => void;
  visible?: boolean;
  zoomTarget?: { lat: number; lng: number } | null;
  onZoomComplete?: () => void;
  previewPin?: { name: string; lat: number; lng: number } | null;
}

const DAY_COLORS = ["#1B4332", "#2563EB", "#F4A261", "#D6336C", "#6D28D9", "#0D9488", "#EAB308"];
const TERRAIN_SOURCE_ID = "mapbox-dem";
const THREE_D_BUILDINGS_LAYER_ID = "3d-buildings";

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

function getDayColor(day: DayPlan, fallbackIndex: number): string {
  return day.color || DAY_COLORS[fallbackIndex % DAY_COLORS.length];
}

function ensureTerrainSource(map: mapboxgl.Map) {
  if (map.getSource(TERRAIN_SOURCE_ID)) return;
  map.addSource(TERRAIN_SOURCE_ID, {
    type: "raster-dem",
    url: "mapbox://mapbox.mapbox-terrain-dem-v1",
    tileSize: 512,
    maxzoom: 14,
  });
}

function add3DBuildingsLayer(map: mapboxgl.Map) {
  if (map.getLayer(THREE_D_BUILDINGS_LAYER_ID)) return;
  if (!map.getSource("composite")) return;

  const labelLayerId = map
    .getStyle()
    .layers?.find((layer) => {
      if (layer.type !== "symbol") return false;
      const layout = layer.layout as { [key: string]: unknown } | undefined;
      return Boolean(layout?.["text-field"]);
    })?.id;

  const buildingsLayer: mapboxgl.FillExtrusionLayer = {
    id: THREE_D_BUILDINGS_LAYER_ID,
    type: "fill-extrusion",
    source: "composite",
    "source-layer": "building",
    filter: ["==", ["get", "extrude"], "true"],
    minzoom: 13,
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "height"], 0],
        0,
        "#d7e3e8",
        120,
        "#9fb3be",
        280,
        "#6f8794",
      ],
      "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
      "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
      "fill-extrusion-opacity": 0.72,
    },
  };

  map.addLayer(buildingsLayer, labelLayerId);
}

function applyTerrainMode(map: mapboxgl.Map, styleId: string, previousPitch: number, previousBearing: number) {
  if (styleId === "terrain") {
    ensureTerrainSource(map);
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.55 });
    map.setFog({});
    add3DBuildingsLayer(map);

    const targetPitch = previousPitch >= 52 ? previousPitch : 62;
    const targetBearing = Math.abs(previousBearing) < 1 ? -20 : previousBearing;
    map.easeTo({ pitch: targetPitch, bearing: targetBearing, duration: 700, essential: true });
    return;
  }

  if (map.getLayer(THREE_D_BUILDINGS_LAYER_ID)) {
    map.removeLayer(THREE_D_BUILDINGS_LAYER_ID);
  }
  map.setTerrain(null);
  map.setFog(null);
}

export function TripMap({ itinerary, highlightedStop, onHighlightStop, focusedDay, onResetFocus, onFocusDay, onStopClick, visible = true, zoomTarget, onZoomComplete, previewPin }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: { marker: mapboxgl.Marker; el: HTMLDivElement } }>({});
  const previewMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const previewPinRef = useRef<{ name: string; lat: number; lng: number } | null>(null);
  const [activeStyle, setActiveStyle] = useState("outdoors");
  const [mapReady, setMapReady] = useState(false);

  const renderPreviewPin = () => {
    const map = mapInstance.current;
    if (!map) return;

    previewMarkerRef.current?.remove();
    previewMarkerRef.current = null;

    const pin = previewPinRef.current;
    if (!pin) return;

    const el = document.createElement("div");
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
        <div style="
          background:rgba(255,255,255,0.94);
          border:1px solid rgba(0,0,0,0.08);
          border-radius:999px;
          padding:3px 10px;
          font-size:11px;
          font-weight:600;
          color:#1B4332;
          max-width:220px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          box-shadow:0 4px 12px rgba(0,0,0,0.15);
          font-family:'Plus Jakarta Sans',sans-serif;
        ">${pin.name}</div>
        <div style="
          width:18px;
          height:18px;
          border-radius:999px;
          background:#F4A261;
          border:2px solid #fff;
          box-shadow:0 3px 10px rgba(0,0,0,0.28);
        "></div>
      </div>
    `;

    previewMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
  };

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
          applyTerrainMode(map, "outdoors", map.getPitch(), map.getBearing());
        }
      });
    });

    return () => {
      cancelled = true;
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
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
      applyTerrainMode(map, styleId, pitch, bearing);
      // Re-add route and markers without resetting position
      addRouteAndMarkers(true);
      renderPreviewPin();
    });
  };

  // Build markers & route
  const addRouteAndMarkers = (skipFitBounds = false) => {
    const map = mapInstance.current;
    if (!map || !itinerary) return;
    const daysToRender = focusedDay !== null
      ? itinerary.filter((day) => day.day === focusedDay)
      : itinerary;

    // Clear old markers
    Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
    markersRef.current = {};

    // Remove old route layer/source
    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getLayer("route-line-dashed")) map.removeLayer("route-line-dashed");
    if (map.getSource("route")) map.removeSource("route");

    const coords: [number, number][] = [];

    daysToRender.forEach((day, dayIdx) => {
      const color = getDayColor(day, dayIdx);
      day.stops.forEach((stop) => {
        coords.push([stop.lng, stop.lat]);

        // Create custom marker element
        const el = document.createElement("div");
        el.className = "mapbox-custom-marker";
        el.style.cursor = "pointer";
        el.style.zIndex = "10";

        const iconPaths = getIconSvg(stop.tags);

        el.innerHTML = `
          <div class="marker-wrapper" style="display:flex;flex-direction:column;align-items:center;transition:transform 0.2s ease;">
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

    // Fit bounds only on initial load
    if (!skipFitBounds) fitBounds(coords);
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
    if (mapReady && itinerary) addRouteAndMarkers(true);
  }, [itinerary, mapReady, focusedDay]);

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
    } else {
      const coords: [number, number][] = itinerary.flatMap((d) => d.stops.map((s) => [s.lng, s.lat] as [number, number]));
      if (coords.length > 0) {
        fitBounds(coords, 70);
      }
    }
  }, [focusedDay, itinerary, mapReady]);

  // Zoom to specific stop
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !zoomTarget || !mapReady) return;
    map.flyTo({ center: [zoomTarget.lng, zoomTarget.lat], zoom: 15, duration: 1000 });
    onZoomComplete?.();
  }, [zoomTarget, mapReady]);

  useEffect(() => {
    previewPinRef.current = previewPin || null;
    if (!mapReady || !mapInstance.current) return;
    renderPreviewPin();
  }, [previewPin, mapReady]);

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
      const color = getDayColor(day, dayIdx);
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
        const wrapper = ref.el.querySelector(".marker-wrapper") as HTMLElement | null;
        if (wrapper) {
          wrapper.style.transform = isHighlighted ? "scale(1.1)" : "scale(1)";
        }
      });
    });
  }, [highlightedStop, itinerary]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      <MapLayerSwitcher activeStyle={activeStyle} onStyleChange={handleStyleChange} />
      {itinerary && (
        <div className="absolute bottom-4 left-4 max-w-[280px] bg-card/90 backdrop-blur-sm rounded-xl border border-border/60 px-3 py-3 shadow-md z-10">
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Map Pins</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={onResetFocus}
              className={`px-2.5 py-1 rounded-full border text-[11px] font-body font-semibold transition-colors ${
                focusedDay === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-secondary"
              }`}
            >
              All pins
            </button>
            {itinerary.map((day, i) => (
              <button
                key={day.day}
                onClick={() => onFocusDay?.(day.day)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-body font-semibold transition-colors ${
                  focusedDay === day.day
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-secondary"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: getDayColor(day, i) }} />
                Day {day.day}
              </button>
            ))}
          </div>
          <p className="text-[10px] font-body text-muted-foreground mt-2">
            {focusedDay !== null ? `Showing pins for Day ${focusedDay}` : "Showing pins for all days"}
          </p>
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
