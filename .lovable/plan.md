

# Destination Detail Panel (Mindtrip-style)

## Overview
Add an interactive destination detail panel that slides open when a user clicks on any stop/city in the itinerary or on a map marker. The panel displays rich, AI-generated information about that destination organized into tabs: Overview, Restaurants, Hotels, Things to Do, and Location.

---

## How It Works

When a user clicks a stop name in a DayCard or clicks a marker on the map, a slide-over panel opens on the right side (replacing/overlaying the map area on desktop, or as a full-screen sheet on mobile). The panel calls an AI edge function to generate real, detailed information about that specific place/city.

---

## 1. New Edge Function: `get-destination-details`

Creates a new backend function that takes a city/place name and returns structured data across categories:

- **Overview**: City description, best time to visit, known-for highlights, safety tips
- **Restaurants**: 6 restaurant recommendations with name, cuisine type, price range, rating, short description
- **Hotels/Stays**: 6 hotel recommendations with name, star rating, price range, neighborhood, short description
- **Things to Do**: 6 attraction/activity recommendations with name, category, rating, price, short description
- **Location**: Lat/lng for embedding a focused Google Map view

Uses the Lovable AI gateway (same as itinerary generation) to produce real, research-based results.

---

## 2. New Component: `DestinationPanel`

A slide-over panel component with:
- **Header**: Destination name, region/country, close button
- **Tabs** (using existing Radix Tabs): Overview | Restaurants | Stays | Things to Do | Location
- **Loading state**: Skeleton placeholders while AI generates content
- **Content cards**: Each tab shows a grid/list of cards with relevant info (name, rating stars, price range, short description)
- **Location tab**: Renders a small focused Google Map centered on the destination

Styled to match Roamly's existing design language (rounded cards, font-body, color scheme).

---

## 3. Integration Points

### DayCard.tsx
- Make each stop name clickable (not just hover-able)
- Clicking a stop name calls a new `onStopClick(stopName, lat, lng)` callback

### TripMap.tsx
- Clicking a marker opens the destination panel for that stop (existing click handler currently opens an info window -- replace with panel trigger)

### TripWorkspace.tsx
- Add state for the selected destination (`selectedStop: { name, lat, lng } | null`)
- Pass it down to the new DestinationPanel
- Layout: panel overlays the map area when open (desktop), or opens as a sheet (mobile)

### ChatPanel.tsx
- Pass through the new `onStopClick` prop to DayCard

---

## Technical Details

### New Files

| File | Purpose |
|------|---------|
| `src/components/DestinationPanel.tsx` | The tabbed destination detail panel component |
| `supabase/functions/get-destination-details/index.ts` | AI edge function to generate destination info |

### Modified Files

| File | Change |
|------|--------|
| `src/components/DayCard.tsx` | Add `onStopClick` callback on stop name click |
| `src/components/TripMap.tsx` | Replace info window click with destination panel trigger |
| `src/pages/TripWorkspace.tsx` | Add `selectedStop` state, render DestinationPanel overlay |
| `src/components/ChatPanel.tsx` | Pass `onStopClick` through to DayCard |

### AI Response Schema (get-destination-details)

The edge function returns structured JSON with:
- `overview`: `{ description, bestTimeToVisit, knownFor: string[], safetyTips: string }`
- `restaurants`: `[{ name, cuisine, priceRange, rating, description }]`
- `stays`: `[{ name, type, priceRange, rating, neighborhood, description }]`
- `thingsToDo`: `[{ name, category, price, rating, description }]`
- `location`: `{ lat, lng, formattedAddress }`

### No new dependencies needed
- Uses existing Radix Tabs, Framer Motion, Lucide icons, and Google Maps

