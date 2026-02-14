# Roamly Improvements: Google Maps, Budget Input, and Functional Action Chips

## Overview

Three enhancements: (1) replace Leaflet with Google Maps and add Places Autocomplete to location inputs, (2) replace budget pill selectors with a dollar amount input, and (3) make the adjustment action chips functional so the experience continues past "Want me to adjust anything?"

---

## 1. Google Maps Integration

### API Key Setup --> AIzaSyD2_5rM437hdvl22M0akhWj20oohLwnB8g (use this)

- Google Maps JavaScript API keys are publishable (restricted by domain referrer, not secret)
- Store the key in the codebase as a constant or pass it inline when loading the script
- Ask the user to provide the key, then embed it in the app

### Replace Leaflet with Google Maps (TripMap.tsx)

- Remove the `leaflet` dependency
- Load the Google Maps JavaScript API dynamically
- Recreate the same functionality: numbered colored markers per day, route polyline connecting stops, hover highlight sync, day-color legend, fit bounds
- Use `google.maps.Map`, `google.maps.Marker` (or `AdvancedMarkerElement`), and `google.maps.Polyline`

### Places Autocomplete on Landing Page (LandingPage.tsx)

- Load the Google Places library alongside the Maps API
- Replace the plain text inputs for "From" and "To" with autocomplete-enabled inputs
- As the user types, a dropdown of place suggestions appears
- On selection, store the formatted place name
- Styled to match the existing Roamly design (custom dropdown appearance)

### New Files

- `src/lib/google-maps.ts` -- Helper to load the Google Maps script once, returns a promise

---

## 2. Budget: Dollar Value Input

### LandingPage.tsx Changes

- Remove the `budgets` array (`["$", "$$", "$$$", "No limit"]`) and pill selector
- Replace with a number input field: label "Budget", placeholder "e.g. 500", with a "$" prefix icon
- Store as a string like "$500" in the trip config
- Update `TripConfig` interface to accept this format
- The nav bar in TripWorkspace will display the actual dollar amount (e.g. "$500")

---

## 3. Functional Action Chips

### ChatPanel.tsx Changes

- Make the four action chips ("Add more stops", "Make it more relaxed", "Swap Day 1 and 2", "Find restaurants near stops") trigger a follow-up AI call
- When clicked, add the action as a user message in chat, show typing indicator, then call the `generate-itinerary` edge function again with the modification instruction appended
- The AI regenerates the itinerary with the adjustment applied
- Replace the existing itinerary cards and map pins with the new result
- Show "Want me to adjust anything?" again after each adjustment

### Edge Function Update (generate-itinerary)

- Add an optional `adjustmentRequest` parameter
- If present, append it to the system prompt: "The user wants to adjust the existing itinerary: [request]. Modify accordingly while keeping the same structure."
- Optionally pass the current itinerary as context so the AI can make targeted changes rather than generating from scratch

---

## Technical Details

### Files Modified


| File                                             | Change                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `src/components/TripMap.tsx`                     | Replace Leaflet with Google Maps API                                      |
| `src/pages/LandingPage.tsx`                      | Add Places Autocomplete to inputs, replace budget pills with dollar input |
| `src/components/ChatPanel.tsx`                   | Make action chips functional with follow-up AI calls                      |
| `src/data/demoTrip.ts`                           | No changes needed (TripConfig.budget already a string)                    |
| `src/pages/TripWorkspace.tsx`                    | Minor update to display budget as dollar amount in nav pill               |
| `supabase/functions/generate-itinerary/index.ts` | Add adjustmentRequest + current itinerary context support                 |
| `package.json`                                   | Remove `leaflet` and `@types/leaflet`, add `@types/google.maps`           |


### New Files


| File                     | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `src/lib/google-maps.ts` | Script loader utility for Google Maps JS API |


### Dependency Changes

- Remove: `leaflet`, `@types/leaflet`
- Add: `@types/google.maps` (for TypeScript types)