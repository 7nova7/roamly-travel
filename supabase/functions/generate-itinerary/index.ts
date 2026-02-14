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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from, to, days, budget, mode, interests, pace, mustSees } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const daysNum = typeof days === "number" ? days : parseDays(days);

    const systemPrompt = `You are an expert road trip planner. Generate a detailed day-by-day road trip itinerary.

Trip details:
- From: ${from}
- To: ${to}
- Duration: ${daysNum} days
- Budget level: ${budget}
- Travel mode: ${mode}
- Interests: ${interests?.join(", ") || "General sightseeing"}
- Pace: ${pace || "Balanced"}
- Must-see spots: ${mustSees || "None specified"}

Requirements:
- Use REAL place names, addresses, and approximate GPS coordinates (lat/lng)
- Include realistic opening hours, costs, and driving times between stops
- Cluster nearby stops together for efficiency
- Order stops around opening hours
- Match the number of stops per day to the pace preference
- Include a mix of activities matching the user's interests
- Each stop needs a unique id (format: d{day}s{stopNum}, e.g. "d1s1")
- Assign appropriate tags to each stop (e.g. "Nature", "Food", "Free", "Historic", "Must-see")
- Make driving time estimates realistic
- Include an estimated total cost per day`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a ${daysNum}-day road trip itinerary from ${from} to ${to}.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_itinerary",
              description: "Generate a structured day-by-day road trip itinerary",
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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Failed to generate itinerary. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI did not return a valid itinerary. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const itinerary = parsed.itinerary.map((day: any, idx: number) => ({
      ...day,
      color: DAY_COLORS[idx % DAY_COLORS.length],
    }));

    return new Response(JSON.stringify({ itinerary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
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
