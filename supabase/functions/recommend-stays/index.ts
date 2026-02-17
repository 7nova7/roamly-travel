import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DESTINATION_RADIUS_KM = 45;

const LOCATION_ALIASES: Record<string, string> = {
  nyc: "New York City, NY, USA",
  "new york city": "New York City, NY, USA",
  sf: "San Francisco, CA, USA",
  la: "Los Angeles, CA, USA",
  dc: "Washington, DC, USA",
  dmv: "Washington, DC, USA",
};

interface GeoAnchor {
  name: string;
  lat: number;
  lng: number;
}

interface StayResult {
  id: string;
  name: string;
  type: string;
  neighborhood: string;
  address: string;
  nightlyPrice: string;
  style: string;
  why: string;
  bestFor: string;
  lat: number;
  lng: number;
}

class StayApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StayApiError";
    this.status = status;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      from,
      to,
      days,
      startDate,
      endDate,
      budgetVibe,
      tripBudget,
      itinerary,
      preferences,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const destination = normalizeLocationInput(to || from || "");
    if (!destination) {
      throw new StayApiError(400, "Destination is required to recommend stays.");
    }

    const mapboxToken = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    const anchor = mapboxToken ? await geocodeLocation(destination, mapboxToken) : null;
    const daysNum = typeof days === "number" ? days : parseDays(days);
    const itinerarySummary = summarizeItineraryForStays(itinerary);
    const prefSummary = summarizePreferences(preferences);

    let systemPrompt = `You are a travel accommodation concierge. Recommend a short list of places to stay.

Trip context:
- Destination: ${destination}
- Duration: ${daysNum} days
- Date window: ${startDate && endDate ? `${startDate} to ${endDate}` : "Flexible dates"}
- Budget vibe: ${budgetVibe || tripBudget || "Balanced"}
- Traveler profile: ${prefSummary}

Requirements:
- Return 6 strong options with variety (boutique, design-forward, practical value, etc.)
- Use REAL accommodation names and plausible addresses
- Keep recommendations in or near neighborhoods that fit the trip plan
- Nightly price should be a realistic range string (e.g. "$180-$240/night")
- Include why each option is a fit for this itinerary
- Avoid duplicate chains unless they are in distinct neighborhoods
- Keep descriptions concise and specific`;

    if (itinerarySummary) {
      systemPrompt += `\n\nNearby activity context:\n${itinerarySummary}`;
    }

    if (anchor) {
      systemPrompt += `\n\nDestination anchor (hard rule):
- Center around ${anchor.name} (${anchor.lat.toFixed(4)}, ${anchor.lng.toFixed(4)})
- Every recommendation must be within ${DESTINATION_RADIUS_KM} km of this anchor`;
    }

    const userMessage = `Recommend stays for ${destination} with budget vibe "${budgetVibe || tripBudget || "Balanced"}".`;
    const stays = await callStayModel(LOVABLE_API_KEY, systemPrompt, userMessage);

    const filtered = anchor
      ? stays.filter((stay) => distanceKm(anchor.lat, anchor.lng, stay.lat, stay.lng) <= DESTINATION_RADIUS_KM)
      : stays;

    if (filtered.length < 3) {
      throw new StayApiError(500, `Couldn't find enough destination-accurate stays for ${destination}. Try again.`);
    }

    return new Response(JSON.stringify({ stays: filtered.slice(0, 6) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof StayApiError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("recommend-stays error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callStayModel(apiKey: string, systemPrompt: string, userMessage: string): Promise<StayResult[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "recommend_stays",
            description: "Return stay recommendations for a destination",
            parameters: {
              type: "object",
              properties: {
                stays: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      type: { type: "string", description: "Hotel, Boutique Hotel, Hostel, Apartment, etc." },
                      neighborhood: { type: "string" },
                      address: { type: "string" },
                      nightlyPrice: { type: "string" },
                      style: { type: "string", description: "Short style label, e.g. Design-forward, Quiet luxury, Value smart" },
                      why: { type: "string", description: "Why this stay fits the itinerary" },
                      bestFor: { type: "string", description: "Best for couples, families, remote work, food scene, etc." },
                      lat: { type: "number" },
                      lng: { type: "number" },
                    },
                    required: ["id", "name", "type", "neighborhood", "address", "nightlyPrice", "style", "why", "bestFor", "lat", "lng"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["stays"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "recommend_stays" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new StayApiError(429, "Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new StayApiError(402, "AI credits exhausted. Please add credits to continue.");
    }
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new StayApiError(500, "Failed to generate stay recommendations. Please try again.");
  }

  const data = await response.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    console.error("No tool call in stay response:", JSON.stringify(data));
    throw new StayApiError(500, "AI did not return valid stay recommendations. Please try again.");
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  const stays = parsed?.stays;
  if (!Array.isArray(stays)) {
    throw new StayApiError(500, "AI did not return valid stay recommendations. Please try again.");
  }

  return stays as StayResult[];
}

function parseDays(tripLength: string): number {
  switch (tripLength?.toLowerCase()) {
    case "day trip": return 1;
    case "weekend": return 3;
    case "full week": return 7;
    default: {
      const num = Number.parseInt(tripLength || "", 10);
      return Number.isNaN(num) ? 3 : num;
    }
  }
}

function summarizeItineraryForStays(itinerary: unknown): string {
  if (!Array.isArray(itinerary)) return "";

  const lines: string[] = [];
  for (const dayRaw of itinerary.slice(0, 4)) {
    if (!dayRaw || typeof dayRaw !== "object") continue;
    const day = dayRaw as Record<string, unknown>;
    const dayLabel = typeof day.day === "number" ? `Day ${day.day}` : "Day";
    const stops = Array.isArray(day.stops) ? day.stops : [];
    const names = stops
      .slice(0, 3)
      .map((stop) => {
        if (!stop || typeof stop !== "object") return null;
        const name = (stop as Record<string, unknown>).name;
        return typeof name === "string" ? name : null;
      })
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) {
      lines.push(`- ${dayLabel}: ${names.join(", ")}`);
    }
  }

  return lines.join("\n");
}

function summarizePreferences(preferences: unknown): string {
  if (!preferences || typeof preferences !== "object") return "General";
  const value = preferences as Record<string, unknown>;
  const interests = Array.isArray(value.interests)
    ? value.interests.filter((entry): entry is string => typeof entry === "string")
    : [];
  const pace = typeof value.pace === "string" ? value.pace : "";

  const chunks: string[] = [];
  if (interests.length > 0) chunks.push(`Interests: ${interests.join(", ")}`);
  if (pace) chunks.push(`Pace: ${pace}`);
  return chunks.length > 0 ? chunks.join(" | ") : "General";
}

function normalizeLocationInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const alias = LOCATION_ALIASES[trimmed.toLowerCase()];
  return alias || trimmed;
}

async function geocodeLocation(query: string, token: string): Promise<GeoAnchor | null> {
  if (!query) return null;
  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
    types: "place,locality,district,region,country",
    language: "en",
  });
  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) {
    console.warn("Mapbox geocode failed:", response.status, query);
    return null;
  }
  const data = await response.json();
  const feature = data?.features?.[0];
  if (!feature?.center || !Array.isArray(feature.center) || feature.center.length < 2) return null;
  const [lng, lat] = feature.center as [number, number];
  return {
    name: feature.place_name || query,
    lat,
    lng,
  };
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number): number {
  return value * (Math.PI / 180);
}
