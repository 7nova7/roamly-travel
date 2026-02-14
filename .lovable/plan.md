

# Make Roamly AI-Powered with Real Trip Planning

## Overview
Replace the hardcoded Seattle-to-Portland demo with a real AI-powered flow. The landing page form will capture each user's unique trip details, pass them to the workspace, and an AI (via Lovable AI Gateway) will generate a personalized itinerary based on the user's inputs (origin, destination, interests, pace, must-sees).

---

## What Changes

### 1. Enable Lovable Cloud + Lovable AI
- Set up Lovable Cloud (Supabase backend)
- Create an edge function `generate-itinerary` that calls the Lovable AI Gateway
- The edge function takes: origin, destination, trip length, budget, travel mode, interests, pace, and must-see spots
- It returns a structured itinerary (JSON) using tool calling to ensure consistent output matching the `DayPlan[]` schema
- Handle 429/402 errors and surface them to the user

### 2. Pass Trip Inputs from Landing Page to Workspace
- When user clicks "Plan My Trip", navigate to `/plan` with the form data (origin, destination, trip length, budget, mode) passed via URL search params or React Router state
- The TripWorkspace reads these values instead of using `DEMO_TRIP`
- The nav bar trip summary pill displays the actual user inputs

### 3. Rework ChatPanel to Use Real User Inputs
- Remove all references to `DEMO_TRIP` and `DEMO_ITINERARY` from the chat flow
- The greeting message uses the actual origin/destination from the user's form
- After gathering interests, pace, and must-see spots, call the `generate-itinerary` edge function
- Parse the AI response into `DayPlan[]` and render itinerary cards + map pins
- The conversation ends at "Want me to adjust anything?" with action chips (no further interaction needed)

### 4. Edge Function: `generate-itinerary`
- Non-streaming call using tool calling to extract structured output
- System prompt instructs the AI to act as a road trip planner, generating a day-by-day itinerary with real place names, approximate coordinates, realistic hours/costs, and driving times
- Uses `google/gemini-3-flash-preview` model
- Tool schema matches the `DayPlan[]` interface (day number, title, subtitle, stops with lat/lng, times, descriptions, tags, costs, drive times)

### 5. Update TripMap
- Remove the import of `DEMO_ITINERARY` (it already receives itinerary via props)
- Dynamically generate day colors for any number of days (not just 3)

### 6. Clean Up demoTrip.ts
- Keep the `DayPlan`, `Stop` interfaces, `INTEREST_OPTIONS`, and `PACE_OPTIONS`
- Remove `DEMO_TRIP` and `DEMO_ITINERARY` constants (no longer needed)

---

## Technical Details

### Edge Function (`supabase/functions/generate-itinerary/index.ts`)

```text
Input: { from, to, days, budget, mode, interests[], pace, mustSees }
Output: { itinerary: DayPlan[] }

Uses Lovable AI Gateway with tool calling:
- Tool name: "generate_itinerary"
- Parameters schema matches DayPlan[] structure
- Includes lat/lng for map pins
- Includes realistic stop data (hours, costs, drive times)
```

### Data Flow

```text
Landing Page Form
    |
    | (navigate with state: { from, to, days, budget, mode })
    v
TripWorkspace
    |
    | (passes trip config to ChatPanel)
    v
ChatPanel
    |
    | Phase 1: Collects interests, pace, must-sees via chat UI
    | Phase 2: Calls edge function with all inputs
    | Phase 3: Renders AI-generated itinerary cards
    v
TripMap (receives itinerary via props, renders pins + route)
```

### Files Modified
- `src/data/demoTrip.ts` -- Remove DEMO_TRIP and DEMO_ITINERARY, keep interfaces and option arrays
- `src/pages/LandingPage.tsx` -- Pass form state via navigation
- `src/pages/TripWorkspace.tsx` -- Read trip config from navigation state, pass to ChatPanel, update nav bar
- `src/components/ChatPanel.tsx` -- Accept trip config as props, call edge function instead of using hardcoded data, render AI-generated itinerary
- `src/components/TripMap.tsx` -- Remove DEMO_ITINERARY import, support dynamic day count
- `supabase/functions/generate-itinerary/index.ts` -- New edge function calling Lovable AI

### Error Handling
- Show toast if AI call fails (network error, 429, 402)
- Fallback message in chat: "Sorry, I couldn't generate your itinerary. Please try again."
- Loading state with the existing route-drawing animation during AI generation

