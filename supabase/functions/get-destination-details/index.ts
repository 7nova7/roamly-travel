import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, lat, lng } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a concise travel guide. Given a destination, return real info with real names and prices. Keep descriptions to 1 sentence each. Be brief.`;

    const userMessage = `Quick travel guide for "${name}" at ${lat},${lng}. Real places, brief descriptions.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_destination_details",
              description: "Return structured destination information with overview, restaurants, hotels, things to do",
              parameters: {
                type: "object",
                properties: {
                  overview: {
                    type: "object",
                    properties: {
                      description: { type: "string", description: "1 short paragraph" },
                      bestTimeToVisit: { type: "string" },
                      knownFor: { type: "array", items: { type: "string" }, description: "3-4 highlights" },
                      safetyTips: { type: "string", description: "Brief safety and practical tips" },
                      language: { type: "string", description: "Primary language spoken" },
                      currency: { type: "string", description: "Local currency" },
                    },
                    required: ["description", "bestTimeToVisit", "knownFor", "safetyTips", "language", "currency"],
                    additionalProperties: false,
                  },
                  restaurants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        cuisine: { type: "string" },
                        priceRange: { type: "string", description: "e.g. $, $$, $$$" },
                        rating: { type: "number", description: "Rating out of 5" },
                         description: { type: "string", description: "1 sentence" },
                        address: { type: "string" },
                      },
                      required: ["name", "cuisine", "priceRange", "rating", "description", "address"],
                      additionalProperties: false,
                    },
                    description: "4 restaurant recommendations",
                  },
                  stays: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        type: { type: "string", description: "e.g. Hotel, Boutique Hotel, Hostel, B&B" },
                        priceRange: { type: "string", description: "e.g. $80-120/night" },
                        rating: { type: "number", description: "Rating out of 5" },
                        neighborhood: { type: "string" },
                         description: { type: "string", description: "1 sentence" },
                      },
                      required: ["name", "type", "priceRange", "rating", "neighborhood", "description"],
                      additionalProperties: false,
                    },
                    description: "4 hotel/stay recommendations",
                  },
                  thingsToDo: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string", description: "e.g. Museum, Park, Landmark, Activity" },
                        price: { type: "string", description: "e.g. Free, $15, $25-40" },
                        rating: { type: "number", description: "Rating out of 5" },
                        description: { type: "string", description: "1 sentence" },
                      },
                      required: ["name", "category", "price", "rating", "description"],
                      additionalProperties: false,
                    },
                    description: "4 activity/attraction recommendations",
                  },
                  location: {
                    type: "object",
                    properties: {
                      lat: { type: "number" },
                      lng: { type: "number" },
                      formattedAddress: { type: "string" },
                      region: { type: "string", description: "Region or country" },
                    },
                    required: ["lat", "lng", "formattedAddress", "region"],
                    additionalProperties: false,
                  },
                },
                required: ["overview", "restaurants", "stays", "thingsToDo", "location"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_destination_details" } },
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
      return new Response(JSON.stringify({ error: "Failed to get destination details." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI did not return valid destination details." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const details = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(details), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-destination-details error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
