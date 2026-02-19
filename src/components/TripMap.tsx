import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CloudSun, Sparkles, ThermometerSun } from "lucide-react";
import { type DayPlan } from "@/data/demoTrip";
import { getMapboxToken, MAPBOX_STYLES } from "@/lib/mapbox";
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

interface CityGeocode {
  lat: number;
  lng: number;
  name: string;
  country: string;
}

interface CityInsightData {
  cityLabel: string;
  facts: string[];
  weatherHeadline: string;
  weatherDetail: string;
  weatherGlyph: string;
  rangeLabel: string;
}

const CITY_FACTS: Record<string, string[]> = {
  paris: [
    "Paris has over 1,600 bakeries, so you are almost always near a fresh pastry stop.",
    "Many museums in Paris offer late-night opening hours on specific weekdays.",
    "The city has over 400 parks and gardens, perfect for route breaks.",
  ],
  dubai: [
    "Dubai Creek was the original trading center before the modern skyline emerged.",
    "Many major attractions in Dubai are best visited early morning to avoid peak heat.",
    "Dubai neighborhoods can feel very different block-to-block, from old souks to futuristic districts.",
  ],
  tokyo: [
    "Tokyo is built as connected neighborhoods, each with its own local food and culture scene.",
    "Many Tokyo attractions open late, which makes evening itinerary blocks very efficient.",
    "Rail stations in Tokyo often double as dining and shopping hubs.",
  ],
  london: [
    "London has more than 170 museums, with many offering free general entry.",
    "Neighborhood markets can be better for local food variety than single-venue dining.",
  ],
  newyork: [
    "New York City has over 1,700 public parks and playgrounds.",
    "Many top landmarks are quieter in early morning and late evening windows.",
  ],
  barcelona: [
    "Barcelona’s grid and beach access make it easy to combine food, culture, and coastal stops in one day.",
    "Late dinners are standard, so evening slots can stay productive.",
  ],
};

const WEATHER_CODE_LOOKUP: Record<number, { label: string; glyph: string }> = {
  0: { label: "Clear", glyph: "☀️" },
  1: { label: "Mainly clear", glyph: "🌤️" },
  2: { label: "Partly cloudy", glyph: "⛅" },
  3: { label: "Overcast", glyph: "☁️" },
  45: { label: "Fog", glyph: "🌫️" },
  48: { label: "Rime fog", glyph: "🌫️" },
  51: { label: "Light drizzle", glyph: "🌦️" },
  53: { label: "Drizzle", glyph: "🌦️" },
  55: { label: "Heavy drizzle", glyph: "🌧️" },
  61: { label: "Light rain", glyph: "🌦️" },
  63: { label: "Rain", glyph: "🌧️" },
  65: { label: "Heavy rain", glyph: "🌧️" },
  71: { label: "Light snow", glyph: "🌨️" },
  73: { label: "Snow", glyph: "🌨️" },
  75: { label: "Heavy snow", glyph: "❄️" },
  80: { label: "Rain showers", glyph: "🌦️" },
  81: { label: "Heavy showers", glyph: "🌧️" },
  82: { label: "Violent showers", glyph: "⛈️" },
  95: { label: "Thunderstorm", glyph: "⛈️" },
  96: { label: "Storm + hail", glyph: "⛈️" },
  99: { label: "Strong storm", glyph: "⛈️" },
};

const insightCache = new Map<string, CityInsightData>();

function pickWeatherMeta(code?: number): { label: string; glyph: string } {
  if (typeof code !== "number") return { label: "Mild conditions", glyph: "🌤️" };
  return WEATHER_CODE_LOOKUP[code] || { label: "Variable conditions", glyph: "🌤️" };
}

function normalizeDestinationLabel(destination?: string): string {
  if (!destination) return "";
  const first = destination.split(",")[0]?.trim();
  return first || destination.trim();
}

function normalizeCityKey(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatDayLabel(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
}

function formatRangeLabel(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return "Today";
  return `${formatDayLabel(startDate)} - ${formatDayLabel(endDate)}`;
}

function celsiusToFahrenheit(value: number): number {
  return (value * 9) / 5 + 32;
}

function formatDualTemp(valueCelsius: number): string {
  const c = Math.round(valueCelsius);
  const f = Math.round(celsiusToFahrenheit(valueCelsius));
  return `${f}°F / ${c}°C`;
}

function sentenceTrim(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= 150) return compact;
  return `${compact.slice(0, 147).trimEnd()}...`;
}

function dedupeFacts(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const fact = sentenceTrim(raw);
    if (!fact) continue;
    if (seen.has(fact)) continue;
    seen.add(fact);
    output.push(fact);
  }
  return output;
}

async function fetchCityGeocode(city: string): Promise<CityGeocode | null> {
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", city);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = await response.json();
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    if (!first) return null;
    const lat = Number(first.latitude);
    const lng = Number(first.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      name: typeof first.name === "string" && first.name.trim() ? first.name.trim() : city,
      country: typeof first.country === "string" ? first.country : "",
    };
  } catch {
    return null;
  }
}

async function fetchWikiFact(city: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data?.extract === "string" && data.extract.trim()) {
      const firstSentence = data.extract.split(/(?<=[.!?])\s+/)[0] || data.extract;
      return sentenceTrim(firstSentence);
    }
    if (typeof data?.description === "string" && data.description.trim()) {
      return sentenceTrim(`${city}: ${data.description}.`);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWeatherSummary(
  geocode: CityGeocode,
  startDate?: string,
  endDate?: string,
): Promise<{ headline: string; detail: string; glyph: string; rangeLabel: string }> {
  const hasSpecificRange = Boolean(startDate && endDate);
  const rangeLabel = formatRangeLabel(startDate, endDate);

  if (hasSpecificRange) {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(geocode.lat));
      url.searchParams.set("longitude", String(geocode.lng));
      url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
      url.searchParams.set("start_date", startDate!);
      url.searchParams.set("end_date", endDate!);
      url.searchParams.set("timezone", "auto");
      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        const maxes = Array.isArray(data?.daily?.temperature_2m_max) ? data.daily.temperature_2m_max as number[] : [];
        const mins = Array.isArray(data?.daily?.temperature_2m_min) ? data.daily.temperature_2m_min as number[] : [];
        const codes = Array.isArray(data?.daily?.weather_code) ? data.daily.weather_code as number[] : [];
        if (maxes.length > 0 && mins.length > 0) {
          const avgMax = maxes.reduce((sum, v) => sum + Number(v || 0), 0) / maxes.length;
          const avgMin = mins.reduce((sum, v) => sum + Number(v || 0), 0) / mins.length;
          const codeCounts = new Map<number, number>();
          codes.forEach((code) => {
            codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
          });
          const mostCommonCode = [...codeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
          const meta = pickWeatherMeta(mostCommonCode);
          return {
            headline: `${meta.label} expected`,
            detail: `Avg high ${formatDualTemp(avgMax)} • avg low ${formatDualTemp(avgMin)} (${rangeLabel}).`,
            glyph: meta.glyph,
            rangeLabel,
          };
        }
      }
    } catch {
      // fallback handled below
    }
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(geocode.lat));
    url.searchParams.set("longitude", String(geocode.lng));
    url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code");
    url.searchParams.set("timezone", "auto");
    const response = await fetch(url.toString());
    if (response.ok) {
      const data = await response.json();
      const current = data?.current || {};
      const temperature = Number(current.temperature_2m);
      const apparent = Number(current.apparent_temperature);
      const meta = pickWeatherMeta(typeof current.weather_code === "number" ? current.weather_code : undefined);
      return {
        headline: `${meta.label} now`,
        detail: Number.isFinite(temperature) && Number.isFinite(apparent)
          ? `${formatDualTemp(temperature)} now, feels like ${formatDualTemp(apparent)}.`
          : "Current conditions are ready for quick route tweaks.",
        glyph: meta.glyph,
        rangeLabel: "Today",
      };
    }
  } catch {
    // final fallback
  }

  return {
    headline: "Weather insight loading",
    detail: "Weather service is temporarily unavailable, but route optimization is still ready.",
    glyph: "🌤️",
    rangeLabel: hasSpecificRange ? rangeLabel : "Today",
  };
}

async function fetchCityInsights(destination?: string, startDate?: string, endDate?: string): Promise<CityInsightData | null> {
  const cityLabel = normalizeDestinationLabel(destination);
  if (!cityLabel) return null;
  const cacheKey = `${normalizeCityKey(cityLabel)}::${startDate || "today"}::${endDate || "today"}`;
  if (insightCache.has(cacheKey)) {
    return insightCache.get(cacheKey)!;
  }

  const geocode = await fetchCityGeocode(cityLabel);
  if (!geocode) return null;

  const [wikiFact, weather] = await Promise.all([
    fetchWikiFact(geocode.name),
    fetchWeatherSummary(geocode, startDate, endDate),
  ]);

  const curated = CITY_FACTS[normalizeCityKey(geocode.name)] || CITY_FACTS[normalizeCityKey(cityLabel)] || [];
  const generatedFacts = [
    `Best routing windows in ${geocode.name} usually come from starting with clustered neighborhoods.`,
    `${geocode.name} rewards mixing iconic stops with nearby local blocks to cut backtracking.`,
    `Transit and walk time in ${geocode.name} can vary sharply by hour, so timing matters.`,
  ];

  const facts = dedupeFacts([wikiFact || "", ...curated, ...generatedFacts]).slice(0, 4);

  const insight: CityInsightData = {
    cityLabel: geocode.name,
    facts,
    weatherHeadline: weather.headline,
    weatherDetail: weather.detail,
    weatherGlyph: weather.glyph,
    rangeLabel: weather.rangeLabel,
  };

  insightCache.set(cacheKey, insight);
  return insight;
}

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
  const showInsightOverlay = !itinerary || itinerary.length === 0;

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
      renderPreviewPin();

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
    renderPreviewPin();
  }, [previewPin, mapReady]);

  // Resize on visibility change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !visible) return;
    setTimeout(() => {
      map.resize();
      if (activeStyle === "terrain") {
        applyTerrainMode(map, "terrain", map.getPitch(), map.getBearing(), isMobile);
        const min3DZoom = isMobile ? MOBILE_3D_MIN_ZOOM : DESKTOP_3D_MIN_ZOOM;
        if (map.getZoom() < min3DZoom) {
          map.easeTo({ zoom: min3DZoom, duration: 450, essential: true });
        }
      }
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
  const goToPreviousSlide = () => {
    if (!hasMultipleSlides) return;
    setSlideIndex((prev) => (prev - 1 + insightSlides.length) % insightSlides.length);
  };
  const goToNextSlide = () => {
    if (!hasMultipleSlides) return;
    setSlideIndex((prev) => (prev + 1) % insightSlides.length);
  };

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
      {showInsightOverlay && activeSlide && (
        <div className="absolute inset-x-4 bottom-4 md:left-6 md:right-auto md:bottom-6 md:w-[64vw] md:max-w-[760px] lg:w-[58vw] lg:max-w-[820px] z-20 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative overflow-hidden rounded-3xl border border-white/30 bg-card/75 backdrop-blur-xl shadow-[0_24px_65px_rgba(0,0,0,0.30)] pointer-events-auto"
          >
            <motion.div
              aria-hidden
              className="absolute -inset-12 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/0.22),transparent_45%),radial-gradient(circle_at_78%_30%,hsl(var(--primary)/0.24),transparent_50%),radial-gradient(circle_at_50%_100%,hsl(var(--primary)/0.16),transparent_60%)]"
              animate={{ rotate: [0, 8, 0], scale: [1, 1.03, 1] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 border border-white/45">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-xs font-body font-semibold text-foreground/90">
                    City Intel: {cityInsights?.cityLabel || normalizeDestinationLabel(destination) || "Destination"}
                  </span>
                </div>
                <span className="text-[11px] font-body text-muted-foreground">
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
                  className="rounded-2xl border border-border/40 bg-background/65 p-4 md:p-5"
                >
                  <p className="text-xs uppercase tracking-wider font-body font-semibold text-muted-foreground mb-2">
                    {activeSlide.kicker}
                  </p>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center shrink-0">
                      {activeSlide.id === "weather" ? (
                        <CloudSun className="w-4 h-4 text-primary" />
                      ) : (
                        <ThermometerSun className="w-4 h-4 text-accent" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-body font-semibold text-foreground flex items-center gap-1.5">
                        <span>{activeSlide.glyph}</span>
                        <span>{activeSlide.title}</span>
                      </p>
                      <p className="text-sm font-body text-muted-foreground mt-1.5 leading-relaxed">
                        {activeSlide.body}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-4 flex items-center justify-between gap-3">
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
                        animate={{ width: slideIndex === idx ? 30 : 10, opacity: slideIndex === idx ? 1 : 0.45 }}
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
                      className="w-8 h-8 rounded-full border border-border/60 bg-background/75 hover:bg-background transition-colors flex items-center justify-center text-foreground"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-body text-muted-foreground min-w-[44px] text-center">
                      {slideIndex + 1}/{insightSlides.length}
                    </span>
                    <button
                      onClick={goToNextSlide}
                      aria-label="Next insight"
                      className="w-8 h-8 rounded-full border border-border/60 bg-background/75 hover:bg-background transition-colors flex items-center justify-center text-foreground"
                    >
                      <ChevronRight className="w-4 h-4" />
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
