import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CloudSun, Sparkles, ThermometerSun } from "lucide-react";
import { type DayPlan } from "@/data/demoTrip";
import { getMapboxToken, MAPBOX_STYLES } from "@/lib/mapbox";
import { fetchCityInsights, normalizeDestinationLabel, type CityInsightData } from "@/lib/city-intel";
import { MapLayerSwitcher } from "@/components/MapLayerSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";

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
  destination?: string;
  startDate?: string;
  endDate?: string;
}

const DAY_COLORS = ["#1B4332", "#2563EB", "#F4A261", "#D6336C", "#6D28D9", "#0D9488", "#EAB308"];
const TERRAIN_SOURCE_ID = "mapbox-dem";
const THREE_D_BUILDINGS_LAYER_ID = "3d-buildings";
const MOBILE_3D_MIN_ZOOM = 11.8;
const DESKTOP_3D_MIN_ZOOM = 10.8;
const INSIGHT_ROTATE_MS = 5200;

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
    minzoom: 11.5,
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

function applyTerrainMode(
  map: mapboxgl.Map,
  styleId: string,
  previousPitch: number,
  previousBearing: number,
  isMobile: boolean,
) {
  if (styleId === "terrain") {
    ensureTerrainSource(map);
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: isMobile ? 1.35 : 1.55 });
    map.setFog({});
    add3DBuildingsLayer(map);

    const minPitch = isMobile ? 50 : 62;
    const targetPitch = previousPitch >= minPitch ? previousPitch : minPitch;
    const targetBearing = Math.abs(previousBearing) < 1 ? (isMobile ? -12 : -20) : previousBearing;
    map.easeTo({ pitch: targetPitch, bearing: targetBearing, duration: 700, essential: true });
    return;
  }

  if (map.getLayer(THREE_D_BUILDINGS_LAYER_ID)) {
    map.removeLayer(THREE_D_BUILDINGS_LAYER_ID);
  }
  map.setTerrain(null);
  map.setFog(null);
}

export function TripMap({
  itinerary,
  highlightedStop,
  onHighlightStop,
  focusedDay,
  onResetFocus,
  onFocusDay,
  onStopClick,
  visible = true,
  zoomTarget,
  onZoomComplete,
  previewPin,
  destination,
  startDate,
  endDate,
}: TripMapProps) {
  const isMobile = useIsMobile();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: { marker: mapboxgl.Marker; el: HTMLDivElement } }>({});
  const previewMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const previewPinRef = useRef<{ name: string; lat: number; lng: number } | null>(null);
  const [activeStyle, setActiveStyle] = useState("outdoors");
  const [mapReady, setMapReady] = useState(false);
  const [cityInsights, setCityInsights] = useState<CityInsightData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const showInsightOverlay = (!itinerary || itinerary.length === 0) && !isMobile;

  const insightSlides = useMemo(() => {
    const cityLabel = cityInsights?.cityLabel || normalizeDestinationLabel(destination) || "your city";
    const facts = cityInsights?.facts && cityInsights.facts.length > 0
      ? cityInsights.facts
      : [`We are collecting local highlights for ${cityLabel}...`];

    const factSlides = facts.map((fact, idx) => ({
      id: `fact-${idx}`,
      kicker: "Fun fact",
      title: `About ${cityLabel}`,
      body: fact,
      glyph: "✨",
    }));

    const weatherSlide = {
      id: "weather",
      kicker: cityInsights?.rangeLabel ? `Weather • ${cityInsights.rangeLabel}` : "Weather",
      title: cityInsights?.weatherHeadline || "Weather snapshot loading",
      body: cityInsights?.weatherDetail || `Checking weather for ${cityLabel}...`,
      glyph: cityInsights?.weatherGlyph || "🌤️",
    };

    return [weatherSlide, ...factSlides];
  }, [cityInsights, destination]);

  const renderPreviewPin = () => {
    const map = mapInstance.current;
    if (!map) return;

    previewMarkerRef.current?.remove();
    previewMarkerRef.current = null;

    if (!visible) return;

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
          applyTerrainMode(map, "outdoors", map.getPitch(), map.getBearing(), false);
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
      applyTerrainMode(map, styleId, pitch, bearing, isMobile);
      // Re-add route and markers without resetting position
      addRouteAndMarkers(true);
      if (visible) {
        renderPreviewPin();
      }

      if (styleId === "terrain") {
        const min3DZoom = isMobile ? MOBILE_3D_MIN_ZOOM : DESKTOP_3D_MIN_ZOOM;
        if (map.getZoom() < min3DZoom) {
          map.easeTo({ zoom: min3DZoom, duration: 700, essential: true });
        }
      }
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
    if (!visible) {
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
      return;
    }
    renderPreviewPin();
  }, [previewPin, mapReady, visible]);

  // Resize on visibility change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (!visible) {
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
      return;
    }
    setTimeout(() => {
      map.resize();
      if (activeStyle === "terrain") {
        applyTerrainMode(map, "terrain", map.getPitch(), map.getBearing(), isMobile);
        const min3DZoom = isMobile ? MOBILE_3D_MIN_ZOOM : DESKTOP_3D_MIN_ZOOM;
        if (map.getZoom() < min3DZoom) {
          map.easeTo({ zoom: min3DZoom, duration: 450, essential: true });
        }
      }
      renderPreviewPin();
    }, 100);
  }, [visible, activeStyle, isMobile]);

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

  useEffect(() => {
    if (!showInsightOverlay) return;

    const cityLabel = normalizeDestinationLabel(destination);
    if (!cityLabel) {
      setCityInsights(null);
      setInsightsLoading(false);
      return;
    }

    let cancelled = false;
    setInsightsLoading(true);
    void fetchCityInsights(cityLabel, startDate, endDate)
      .then((insights) => {
        if (cancelled) return;
        setCityInsights(insights);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination, endDate, showInsightOverlay, startDate]);

  useEffect(() => {
    setSlideIndex(0);
  }, [destination, startDate, endDate, cityInsights?.cityLabel]);

  useEffect(() => {
    if (!showInsightOverlay || insightSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % insightSlides.length);
    }, INSIGHT_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [insightSlides.length, showInsightOverlay]);

  const activeSlide = insightSlides[Math.max(0, Math.min(slideIndex, insightSlides.length - 1))];
  const hasMultipleSlides = insightSlides.length > 1;
  const slideBodyCopy = isMobile && activeSlide?.body.length > 118
    ? `${activeSlide.body.slice(0, 115).trimEnd()}...`
    : activeSlide?.body;
  const goToPreviousSlide = () => {
    if (!hasMultipleSlides) return;
    setSlideIndex((prev) => (prev - 1 + insightSlides.length) % insightSlides.length);
  };
  const goToNextSlide = () => {
    if (!hasMultipleSlides) return;
    setSlideIndex((prev) => (prev + 1) % insightSlides.length);
  };

  return (
    <div className={`relative h-full w-full ${visible ? "" : "invisible"}`}>
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
      {showInsightOverlay && activeSlide && (
        <div
          className={
            isMobile
              ? "absolute top-3 left-3 right-[4.25rem] z-20 pointer-events-none"
              : "absolute inset-x-4 bottom-4 md:left-6 md:right-auto md:bottom-6 md:w-[64vw] md:max-w-[760px] lg:w-[58vw] lg:max-w-[820px] z-20 pointer-events-none"
          }
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className={
              isMobile
                ? "relative overflow-hidden rounded-2xl border border-white/35 bg-card/78 backdrop-blur-xl shadow-[0_16px_38px_rgba(0,0,0,0.28)] pointer-events-auto"
                : "relative overflow-hidden rounded-3xl border border-white/30 bg-card/75 backdrop-blur-xl shadow-[0_24px_65px_rgba(0,0,0,0.30)] pointer-events-auto"
            }
          >
            <motion.div
              aria-hidden
              className="absolute -inset-12 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/0.22),transparent_45%),radial-gradient(circle_at_78%_30%,hsl(var(--primary)/0.24),transparent_50%),radial-gradient(circle_at_50%_100%,hsl(var(--primary)/0.16),transparent_60%)]"
              animate={{ rotate: [0, 8, 0], scale: [1, 1.03, 1] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className={isMobile ? "relative p-3.5" : "relative p-5 md:p-6"}>
              <div className={isMobile ? "flex items-center justify-between mb-2.5" : "flex items-center justify-between mb-4"}>
                <div className={isMobile ? "inline-flex items-center gap-1.5 rounded-full bg-white/72 px-2.5 py-1 border border-white/45" : "inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 border border-white/45"}>
                  <Sparkles className={isMobile ? "w-3.5 h-3.5 text-accent" : "w-4 h-4 text-accent"} />
                  <span className={isMobile ? "text-[11px] font-body font-semibold text-foreground/90" : "text-xs font-body font-semibold text-foreground/90"}>
                    City Intel: {cityInsights?.cityLabel || normalizeDestinationLabel(destination) || "Destination"}
                  </span>
                </div>
                <span className={isMobile ? "text-[10px] font-body text-muted-foreground" : "text-[11px] font-body text-muted-foreground"}>
                  {insightsLoading ? "Updating..." : "Live preview"}
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlide.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}
                  className={isMobile ? "rounded-xl border border-border/45 bg-background/65 p-3" : "rounded-2xl border border-border/40 bg-background/65 p-4 md:p-5"}
                >
                  <p className={isMobile ? "text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground mb-1.5" : "text-xs uppercase tracking-wider font-body font-semibold text-muted-foreground mb-2"}>
                    {activeSlide.kicker}
                  </p>
                  <div className={isMobile ? "flex items-start gap-2.5" : "flex items-start gap-3"}>
                    <div className={isMobile ? "w-8 h-8 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center shrink-0" : "w-9 h-9 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center shrink-0"}>
                      {activeSlide.id === "weather" ? (
                        <CloudSun className={isMobile ? "w-3.5 h-3.5 text-primary" : "w-4 h-4 text-primary"} />
                      ) : (
                        <ThermometerSun className={isMobile ? "w-3.5 h-3.5 text-accent" : "w-4 h-4 text-accent"} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={isMobile ? "text-sm font-body font-semibold text-foreground flex items-center gap-1" : "text-base font-body font-semibold text-foreground flex items-center gap-1.5"}>
                        <span>{activeSlide.glyph}</span>
                        <span>{activeSlide.title}</span>
                      </p>
                      <p className={isMobile ? "text-xs font-body text-muted-foreground mt-1 leading-snug" : "text-sm font-body text-muted-foreground mt-1.5 leading-relaxed"}>
                        {slideBodyCopy}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className={isMobile ? "mt-2.5 flex items-center justify-between gap-2" : "mt-4 flex items-center justify-between gap-3"}>
                <div className="flex items-center gap-2">
                  {insightSlides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      onClick={() => setSlideIndex(idx)}
                      aria-label={`Show insight ${idx + 1}`}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                    >
                      <motion.span
                        className="block h-2 rounded-full bg-primary/30"
                        animate={{ width: slideIndex === idx ? (isMobile ? 22 : 30) : (isMobile ? 8 : 10), opacity: slideIndex === idx ? 1 : 0.45 }}
                        transition={{ duration: 0.2 }}
                      />
                    </button>
                  ))}
                </div>

                {hasMultipleSlides && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={goToPreviousSlide}
                      aria-label="Previous insight"
                      className={isMobile ? "w-7 h-7 rounded-full border border-border/60 bg-background/75 hover:bg-background transition-colors flex items-center justify-center text-foreground" : "w-8 h-8 rounded-full border border-border/60 bg-background/75 hover:bg-background transition-colors flex items-center justify-center text-foreground"}
                    >
                      <ChevronLeft className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
                    </button>
                    <span className={isMobile ? "text-[11px] font-body text-muted-foreground min-w-[34px] text-center" : "text-xs font-body text-muted-foreground min-w-[44px] text-center"}>
                      {slideIndex + 1}/{insightSlides.length}
                    </span>
                    <button
                      onClick={goToNextSlide}
                      aria-label="Next insight"
                      className={isMobile ? "w-7 h-7 rounded-full border border-border/60 bg-background/75 hover:bg-background transition-colors flex items-center justify-center text-foreground" : "w-8 h-8 rounded-full border border-border/60 bg-background/75 hover:bg-background transition-colors flex items-center justify-center text-foreground"}
                    >
                      <ChevronRight className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
