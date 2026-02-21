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
  admin1: string;
}

const CITY_FACTS: Record<string, string[]> = {
  paris: [
    "Paris is known for neighborhood bakeries, so you are usually close to a pastry stop.",
    "Many museums in Paris offer late-night opening hours on specific weekdays.",
    "Paris has many parks and gardens that work well as route breaks between major sights.",
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
    "London has many museums, and several major ones offer free general entry.",
    "Neighborhood markets can be better for local food variety than single-venue dining.",
  ],
  newyork: [
    "New York City has a broad network of public parks across all five boroughs.",
    "Many top landmarks are quieter in early morning and late evening windows.",
  ],
  barcelona: [
    "Barcelona’s grid and beach access make it easy to combine food, culture, and coastal stops in one day.",
    "Late dinners are standard, so evening slots can stay productive.",
  ],
  seattle: [
    "Pike Place Market opened in 1907 and is one of the oldest continuously operating public markets in the U.S.",
    "Seattle was a host city for the 1962 World's Fair, where the Space Needle was built.",
    "Seattle sits between Puget Sound and Lake Washington, so water and skyline views are common across the city.",
    "On clear days, Mount Rainier can be visible from parts of Seattle.",
    "Seattle has many neighborhood business districts, so grouping stops by area can save a lot of travel time.",
    "Ferry terminals connect central Seattle to nearby islands and peninsulas, which can shape day-trip timing.",
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
  const compact = destination.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const routeSegment = compact.split(/(?:->|→|\|)/)[0]?.trim() || compact;
  const first = routeSegment.split(",")[0]?.trim();
  return first || routeSegment;
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

function splitIntoSentences(value: string): string[] {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return [];
  // Split only when next token looks like a new sentence start.
  const parts = compact.split(/(?<=[.!?])\s+(?=[A-Z])/);
  return parts.map((part) => sentenceTrim(part)).filter(Boolean);
}

function dedupeFacts(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const fact = sentenceTrim(raw);
    if (!fact) continue;
    const dedupeKey = fact.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    output.push(fact);
  }
  return output;
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash);
}

function rotateFacts(values: string[], seedKey: string, count: number): string[] {
  const facts = dedupeFacts(values);
  if (facts.length <= count) return facts;
  const start = hashSeed(seedKey) % facts.length;
  const rotated = [...facts.slice(start), ...facts.slice(0, start)];
  return rotated.slice(0, count);
}

function buildFallbackFacts(city: string, country: string): string[] {
  const countryLabel = country || "this country";
  return [
    `${city} is located in ${countryLabel}.`,
    `Grouping stops by neighborhood in ${city} usually reduces backtracking.`,
    `Popular attractions in ${city} are often easier to visit earlier in the day.`,
    `Transit and traffic timing in ${city} can shift by hour, so sequence matters.`,
    `${city} mixes landmark areas with local neighborhoods, so balanced routing improves pace.`,
  ];
}

function selectFactSet(
  curated: string[],
  wikiFact: string | null,
  fallbackFacts: string[],
  seedKey: string,
  count: number,
): string[] {
  const citySpecificPool = dedupeFacts([wikiFact || "", ...curated]);
  if (citySpecificPool.length >= count) {
    return rotateFacts(citySpecificPool, `${seedKey}::city`, count);
  }

  const selected = rotateFacts(citySpecificPool, `${seedKey}::city`, citySpecificPool.length);
  const rotatedFallback = rotateFacts(fallbackFacts, `${seedKey}::fallback`, fallbackFacts.length);
  for (const fact of rotatedFallback) {
    if (selected.includes(fact)) continue;
    selected.push(fact);
    if (selected.length >= count) break;
  }
  return selected.slice(0, count);
}

function sanitizeWikiFact(city: string, fact: string | null): string | null {
  if (!fact) return null;
  const trimmed = sentenceTrim(fact);
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const cityLower = city.toLowerCase();
  if (!lower.includes(cityLower)) return null;
  if (lower.includes("may refer to")) return null;
  if (lower.includes("can refer to")) return null;

  if (
    (lower.includes("most populous city in the u.s.") || lower.includes("most populous city in the united states")) &&
    !lower.includes("state of")
  ) {
    return null;
  }

  return trimmed;
}

function buildGeocodeCandidates(destinationQuery: string, cityLabel: string): string[] {
  const compactQuery = destinationQuery.replace(/\s+/g, " ").trim();
  const routeSegment = compactQuery.split(/(?:->|→|\|)/)[0]?.trim() || compactQuery;
  const commaSegment = routeSegment.split(",")[0]?.trim() || routeSegment;
  const noParens = commaSegment.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const candidates = [compactQuery, routeSegment, commaSegment, noParens, cityLabel];

  const words = noParens.split(" ").filter(Boolean);
  for (let size = words.length; size >= 1; size -= 1) {
    candidates.push(words.slice(0, size).join(" "));
  }

  const seen = new Set<string>();
  return candidates
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function buildWikiTitleCandidates(geocode: CityGeocode, destinationQuery?: string): string[] {
  const candidates = [
    destinationQuery || "",
    geocode.admin1 ? `${geocode.name}, ${geocode.admin1}` : "",
    geocode.country ? `${geocode.name}, ${geocode.country}` : "",
    geocode.name,
  ];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const candidate of candidates) {
    const cleaned = candidate.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

async function fetchCityGeocode(query: string): Promise<CityGeocode | null> {
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
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
      name: typeof first.name === "string" && first.name.trim() ? first.name.trim() : query,
      country: typeof first.country === "string" ? first.country : "",
      admin1: typeof first.admin1 === "string" ? first.admin1 : "",
    };
  } catch {
    return null;
  }
}

async function resolveCityGeocode(destinationQuery: string, cityLabel: string): Promise<CityGeocode | null> {
  const candidates = buildGeocodeCandidates(destinationQuery, cityLabel);
  for (const candidate of candidates) {
    const result = await fetchCityGeocode(candidate);
    if (result) return result;
  }
  return null;
}

async function fetchWikiFact(geocode: CityGeocode, destinationQuery?: string): Promise<string | null> {
  const titles = buildWikiTitleCandidates(geocode, destinationQuery);
  for (const title of titles) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (typeof data?.type === "string" && data.type.toLowerCase() === "disambiguation") continue;
      if (typeof data?.extract === "string" && data.extract.trim()) {
        const firstSentence = splitIntoSentences(data.extract)[0] || sentenceTrim(data.extract);
        if (firstSentence) return firstSentence;
      }
      if (typeof data?.description === "string" && data.description.trim()) {
        return sentenceTrim(`${geocode.name} is ${data.description}.`);
      }
    } catch {
      // try next title candidate
    }
  }
  return null;
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
  const destinationQuery = typeof destination === "string" ? destination.trim() : "";
  const cityLabel = normalizeDestinationLabel(destinationQuery);
  if (!cityLabel) return null;
  const cacheKey = `${normalizeCityKey(destinationQuery || cityLabel)}::${startDate || "today"}::${endDate || "today"}`;
  if (insightCache.has(cacheKey)) {
    return insightCache.get(cacheKey)!;
  }

  const geocode = await resolveCityGeocode(destinationQuery || cityLabel, cityLabel);
  if (!geocode) {
    const fallback: CityInsightData = {
      cityLabel,
      facts: rotateFacts(buildFallbackFacts(cityLabel, ""), cacheKey, 4),
      weatherHeadline: "Weather unavailable",
      weatherDetail: `We could not resolve live weather for ${cityLabel} right now.`,
      weatherGlyph: "🌤️",
      rangeLabel: formatRangeLabel(startDate, endDate),
    };
    insightCache.set(cacheKey, fallback);
    return fallback;
  }

  const [wikiFactRaw, weather] = await Promise.all([
    fetchWikiFact(geocode, destinationQuery || cityLabel),
    fetchWeatherSummary(geocode, startDate, endDate),
  ]);
  const wikiFact = sanitizeWikiFact(geocode.name, wikiFactRaw);

  const curated = CITY_FACTS[normalizeCityKey(geocode.name)] || CITY_FACTS[normalizeCityKey(cityLabel)] || [];
  const fallbackFacts = buildFallbackFacts(geocode.name, geocode.country);
  const facts = selectFactSet(curated, wikiFact, fallbackFacts, cacheKey, 4);

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
