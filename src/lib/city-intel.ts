export interface CityInsightData {
  cityLabel: string;
  facts: string[];
  weatherHeadline: string;
  weatherDetail: string;
  weatherGlyph: string;
  rangeLabel: string;
}

interface CityGeocode {
  lat: number;
  lng: number;
  name: string;
  country: string;
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

export function normalizeDestinationLabel(destination?: string): string {
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

export async function fetchCityInsights(destination?: string, startDate?: string, endDate?: string): Promise<CityInsightData | null> {
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
