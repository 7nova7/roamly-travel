import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_COLORS = [
  "hsl(153, 44%, 17%)",
  "hsl(210, 60%, 45%)",
  "hsl(28, 89%, 67%)",
  "hsl(340, 65%, 47%)",
  "hsl(262, 52%, 47%)",
  "hsl(173, 58%, 39%)",
  "hsl(43, 96%, 56%)",
];

const SINGLE_DESTINATION_RADIUS_KM = 55;

const LOCATION_ALIASES: Record<string, string> = {
  nyc: "New York City, NY, USA",
  "new york city": "New York City, NY, USA",
  sf: "San Francisco, CA, USA",
  la: "Los Angeles, CA, USA",
  dc: "Washington, DC, USA",
  dmv: "Washington, DC, USA",
};

class PlannerApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PlannerApiError";
    this.status = status;
  }
}

interface GeoAnchor {
  name: string;
  lat: number;
  lng: number;
}

interface StopOutlier {
  day: number;
  name: string;
  distanceKm: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from, to, days, budget, mode, interests, pace, mustSees, adjustmentRequest, currentItinerary, startDate, endDate } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const daysNum = typeof days === "number" ? days : parseDays(days);
    const fromText = normalizeLocationInput(from);
    const toText = normalizeLocationInput(to);

    const mapboxToken = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    const fromAnchor = mapboxToken ? await geocodeLocation(fromText, mapboxToken) : null;
    const toAnchor = mapboxToken ? await geocodeLocation(toText, mapboxToken) : null;
    const isSingleDestinationTrip = isLikelySingleDestinationTrip(fromText, toText, fromAnchor, toAnchor);

    let systemPrompt = `You are an expert travel planner. Generate a detailed day-by-day trip itinerary.

Trip details:
- From: ${fromText}
- To: ${toText}
- Duration: ${daysNum} days
- Budget level: ${budget}
- Travel mode: ${mode}
- Interests: ${interests?.join(", ") || "General sightseeing"}
- Pace: ${pace || "Balanced"}
- Must-see spots: ${mustSees || "None specified"}

Requirements:
- Use REAL place names, addresses, and approximate GPS coordinates (lat/lng)
- Include realistic opening hours, costs, and travel times between stops
- Cluster nearby stops together for efficiency
- Order stops around opening hours
- Match the number of stops per day to the pace preference
- Include a mix of activities matching the user's interests
- Each stop needs a unique id (format: d{day}s{stopNum}, e.g. "d1s1")
- Assign appropriate tags to each stop (e.g. "Nature", "Food", "Free", "Historic", "Must-see")
- Make travel time estimates realistic for the chosen mode
- Include an estimated total cost per day

TRAVEL MODE COST ESTIMATION:
- For "${mode}" travel mode, use realistic cost estimates based on current typical pricing:
  - If Plane: estimate average flight ticket prices between cities (economy class), include airport transfer costs
  - If Car: estimate fuel costs based on distance and average fuel prices, plus tolls and parking
  - If Train: estimate train ticket prices between cities based on typical rail fares
- The "driveFromPrev" field should reflect the travel mode (e.g. "2h flight", "4h 30m drive", "3h train")
- The "estimatedCost" per day should include both travel costs and activity costs
- Factor the travel mode into how stops are structured (flying between distant cities vs driving through towns)`;

    if (isSingleDestinationTrip && toAnchor) {
      systemPrompt += `\n\nDESTINATION ANCHOR (HARD RULE):
- This is a destination-focused trip centered on ${toAnchor.name} (${toAnchor.lat.toFixed(4)}, ${toAnchor.lng.toFixed(4)}).
- Every activity stop must be within ${SINGLE_DESTINATION_RADIUS_KM} km of this destination center.
- Do NOT include attractions from different metro areas.
- If a place has multiple branches, choose the one in ${toAnchor.name}.`;
    } else if (fromAnchor && toAnchor) {
      systemPrompt += `\n\nROUTE ANCHOR:
- Start near ${fromAnchor.name} (${fromAnchor.lat.toFixed(4)}, ${fromAnchor.lng.toFixed(4)}), finish near ${toAnchor.name} (${toAnchor.lat.toFixed(4)}, ${toAnchor.lng.toFixed(4)}).
- Stops must be geographically plausible along this route and should not jump to unrelated distant metros.`;
    }

    if (startDate && endDate) {
      systemPrompt += `\n\nSPECIFIC DATES: This trip runs from ${startDate} to ${endDate}. Use these exact dates in your day titles (e.g. "Day 1 — Mar 15: Seattle to Olympia"). Factor in seasonal considerations, day-of-week opening hours, and any relevant events during these dates.`;
    }

    if (adjustmentRequest) {
      systemPrompt += `\n\nIMPORTANT ADJUSTMENT REQUEST: The user wants to modify the existing itinerary: "${adjustmentRequest}". Apply this adjustment while keeping the same general structure and real place data. Make targeted changes rather than regenerating everything from scratch.`;
      if (currentItinerary) {
        systemPrompt += `\n\nCurrent itinerary to modify:\n${currentItinerary}`;
      }
    }

    const userMessage = adjustmentRequest
      ? `Adjust the existing ${daysNum}-day itinerary from ${fromText} to ${toText}: ${adjustmentRequest}`
      : isSingleDestinationTrip
        ? `Generate a ${daysNum}-day itinerary focused on ${toText}.`
        : `Generate a ${daysNum}-day itinerary from ${fromText} to ${toText}.`;

    let generatedDays = await callPlannerModel(LOVABLE_API_KEY, systemPrompt, userMessage);

    if (isSingleDestinationTrip && toAnchor) {
      const outliers = findOutOfAreaStops(generatedDays, toAnchor, SINGLE_DESTINATION_RADIUS_KM);
      if (outliers.length > 0) {
        const examples = outliers
          .slice(0, 4)
          .map((o) => `${o.name} (Day ${o.day}, ${o.distanceKm.toFixed(0)}km away)`)
          .join("; ");

        const correctionSystemPrompt = `${systemPrompt}

QUALITY CONTROL FAILURE:
- Previous draft included out-of-area stops: ${examples}
- Regenerate from scratch.
- Keep all stops strictly within ${SINGLE_DESTINATION_RADIUS_KM} km of ${toAnchor.name}.`;

        generatedDays = await callPlannerModel(
          LOVABLE_API_KEY,
          correctionSystemPrompt,
          `Regenerate the ${daysNum}-day itinerary for ${toText} and keep every stop local to that destination.`,
        );

        const retryOutliers = findOutOfAreaStops(generatedDays, toAnchor, SINGLE_DESTINATION_RADIUS_KM);
        if (retryOutliers.length > 0) {
          throw new Error(`Could not generate a destination-accurate itinerary for ${toText}. Please try a more specific destination.`);
        }
      }
    }

    const itinerary = (generatedDays as Record<string, unknown>[]).map((day, idx) => ({
      ...day,
      color: DAY_COLORS[idx % DAY_COLORS.length],
    }));

    return new Response(JSON.stringify({ itinerary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof PlannerApiError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("generate-itinerary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseDays(tripLength: string): number {
  switch (tripLength?.toLowerCase()) {
    case "day trip": return 1;
    case "weekend": return 3;
    case "full week": return 7;
    default:
      const num = parseInt(tripLength);
      return isNaN(num) ? 3 : num;
  }
}

function normalizeLocationInput(value: unknown): string {
  if (typeof value !== "string") return "";
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

function isLikelySingleDestinationTrip(
  fromText: string,
  toText: string,
  fromAnchor: GeoAnchor | null,
  toAnchor: GeoAnchor | null,
): boolean {
  if (!fromText || !toText) return false;
  if (fromText.toLowerCase() === toText.toLowerCase()) return true;
  if (!fromAnchor || !toAnchor) return false;
  return distanceKm(fromAnchor.lat, fromAnchor.lng, toAnchor.lat, toAnchor.lng) <= 45;
}

function findOutOfAreaStops(
  days: unknown[],
  center: GeoAnchor,
  radiusKm: number,
): StopOutlier[] {
  const outliers: StopOutlier[] = [];
  if (!Array.isArray(days)) return outliers;

  for (const dayRaw of days) {
    const day = asRecord(dayRaw);
    const dayNum = typeof day?.day === "number" ? day.day : 0;
    const stops = Array.isArray(day?.stops) ? day.stops : [];
    for (const stopRaw of stops) {
      const stop = asRecord(stopRaw);
      const lat = typeof stop?.lat === "number" ? stop.lat : null;
      const lng = typeof stop?.lng === "number" ? stop.lng : null;
      if (lat === null || lng === null) continue;
      const d = distanceKm(center.lat, center.lng, lat, lng);
      if (d > radiusKm) {
        outliers.push({
          day: dayNum,
          name: typeof stop?.name === "string" ? stop.name : "Unknown stop",
          distanceKm: d,
        });
      }
    }
  }

  return outliers;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
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

async function callPlannerModel(apiKey: string, systemPrompt: string, userMessage: string): Promise<unknown[]> {
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
            name: "generate_itinerary",
            description: "Generate a structured day-by-day itinerary with realistic in-destination stops",
            parameters: {
              type: "object",
              properties: {
                itinerary: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "number", description: "Day number" },
                      title: { type: "string", description: "Day title, e.g. 'Seattle to Olympia'" },
                      subtitle: { type: "string", description: "Short theme, e.g. 'Nature & Scenic'" },
                      totalDriving: { type: "string", description: "Total driving time, e.g. '3h 20m'" },
                      estimatedCost: { type: "string", description: "Estimated cost for the day, e.g. '$85'" },
                      stops: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string", description: "Unique stop ID, format d{day}s{num}" },
                            time: { type: "string", description: "Suggested arrival time, e.g. '9:00 AM'" },
                            name: { type: "string", description: "Place name" },
                            description: { type: "string", description: "1-2 sentence description of why to visit" },
                            hours: { type: "string", description: "Opening hours" },
                            cost: { type: "string", description: "Entry cost" },
                            driveFromPrev: { type: "string", description: "Drive time from previous stop" },
                            lat: { type: "number", description: "Latitude" },
                            lng: { type: "number", description: "Longitude" },
                            tags: { type: "array", items: { type: "string" }, description: "Tags like Nature, Food, Free" },
                          },
                          required: ["id", "time", "name", "description", "hours", "cost", "lat", "lng", "tags"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["day", "title", "subtitle", "totalDriving", "estimatedCost", "stops"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["itinerary"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_itinerary" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new PlannerApiError(429, "Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new PlannerApiError(402, "AI credits exhausted. Please add credits to continue.");
    }
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new PlannerApiError(500, "Failed to generate itinerary. Please try again.");
  }

  const data = await response.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    console.error("No tool call in response:", JSON.stringify(data));
    throw new PlannerApiError(500, "AI did not return a valid itinerary. Please try again.");
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  const itinerary = parsed?.itinerary;
  if (!Array.isArray(itinerary)) {
    throw new PlannerApiError(500, "AI did not return a valid itinerary. Please try again.");
  }
  return itinerary;
}
