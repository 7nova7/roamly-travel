

# Roamly Enhancements: Travel Modes, Map Zoom on Day Click, and Free-Text Chat

## Overview
Three changes: (1) replace Car/RV/Motorcycle travel modes with Plane/Car/Train and have the AI estimate real travel costs per mode, (2) clicking a day card zooms the map to that day's stops, and (3) add a "Something else" chip + text input after action chips so users can type custom adjustment requests.

---

## 1. Travel Modes: Plane, Car, Train with Cost Estimates

### LandingPage.tsx
- Replace the `travelModes` array: swap `Car`/`Truck`/`Motorcycle` for `Plane`/`Car`/`Train`
- Use lucide icons: `Plane`, `Car`, `TrainFront`
- Default selection stays "Car"

### Edge Function (generate-itinerary)
- Update the system prompt to instruct the AI to research and include realistic cost estimates for the selected travel mode
- Add to prompt: "For the travel mode '{mode}', include realistic estimated costs based on current typical pricing (e.g., average flight prices between cities, gas costs for driving distance, train ticket estimates). Break down travel costs in the day's estimatedCost field."
- The AI will factor mode into driving/travel time labels (e.g., "2h flight" vs "6h drive" vs "4h train")

---

## 2. Click Day Card to Zoom Map

### New Prop: `onDayClick`
- Add `onDayClick: (dayNumber: number) => void` callback flowing from TripWorkspace through ChatPanel to DayCard
- TripMap exposes a `zoomToDay` method (via a new prop or ref callback)

### DayCard.tsx
- Make the day header clickable. When user clicks the day header bar, call `onDayClick(day.day)`

### TripMap.tsx
- Accept a new prop `focusedDay: number | null`
- When `focusedDay` changes, compute the bounds of just that day's stops and call `map.fitBounds()` with those bounds (with some padding)
- Add a "Show all" button overlay when zoomed into a single day, to reset to full trip bounds

### TripWorkspace.tsx
- Add `focusedDay` state, pass it down to both ChatPanel (-> DayCard) and TripMap
- Wire `onDayClick` to set `focusedDay`, and a reset callback for the "Show all" button

---

## 3. "Something Else" Free-Text Chat Input

### ChatPanel.tsx - ActionChips Component
- Add a 5th chip: "Something else..." styled distinctly (e.g., outlined instead of filled)
- When clicked, show a text input below the chips where the user can type a custom adjustment request
- On submit (Enter or send button), treat it like any other action chip: add as user message, call `generateItinerary` with their text as the `adjustmentRequest`
- After each adjustment completes, the action chips (including "Something else") reappear, allowing unlimited back-and-forth

### Flow
```text
[Action Chips: "Add more stops" | "Make it more relaxed" | "Swap Day 1 and 2" | "Find restaurants" | "Something else..."]
                                                                                                          |
                                                                                                    (click)
                                                                                                          v
                                                                                            [Text input appears]
                                                                                            User types: "Add a beach day"
                                                                                                          |
                                                                                                    (submit)
                                                                                                          v
                                                                                            AI adjusts itinerary
                                                                                                          v
                                                                                            [Action chips reappear]
```

---

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/pages/LandingPage.tsx` | Replace travel mode options with Plane/Car/Train |
| `src/components/ChatPanel.tsx` | Add "Something else" chip with text input; pass `onDayClick` through to DayCard |
| `src/components/DayCard.tsx` | Add `onDayClick` prop, make day header clickable |
| `src/components/TripMap.tsx` | Add `focusedDay` prop with zoom-to-day and "Show all" button |
| `src/pages/TripWorkspace.tsx` | Add `focusedDay` state, wire day click and reset callbacks |
| `supabase/functions/generate-itinerary/index.ts` | Update system prompt to include travel-mode-specific cost estimates |

### No new dependencies needed
- `Plane` and `TrainFront` icons already exist in lucide-react
