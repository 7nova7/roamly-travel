

# Elegant Map Markers with Names and Activity Icons

## What Changes

Replace the current simple numbered circle markers on the map with rich, pill-shaped markers inspired by the Mindtrip reference screenshot. Each marker will display:

- A category icon (matching the stop's tags/activity type)
- The stop name as a label
- A colored accent dot indicating the day

The markers will use Google Maps OverlayView (custom HTML overlays) instead of basic SVG Marker icons, enabling full HTML/CSS styling for a polished look.

---

## Visual Design

Each marker will be a white rounded pill with a subtle shadow, containing:
- A small icon on the left (e.g., fork-knife for restaurants, camera for photo spots, mountain for hiking, landmark for museums, etc.)
- The stop name text
- On hover/highlight: slightly larger with a colored border matching the day color

```
 [icon]  Stop Name
```

---

## Technical Details

### Icon Mapping Logic

A helper function maps stop tags (e.g., "Food & Drink", "Hiking & Nature", "History & Culture") to appropriate Unicode/SVG icons:

| Tag | Icon |
|-----|------|
| Food & Drink | fork-knife symbol |
| Hiking & Nature | mountain/tree symbol |
| History & Culture | landmark/columns symbol |
| Art & Music | palette symbol |
| Photography Spots | camera symbol |
| Adventure Sports | climbing symbol |
| Shopping | bag symbol |
| Scenic Drives | car symbol |
| Default | map-pin symbol |

### Replacing Markers with Custom Overlays

**`src/components/TripMap.tsx`** will be updated:

1. Replace `google.maps.Marker` with `google.maps.OverlayView` custom class
2. Each overlay renders a styled HTML div (white pill, shadow, icon + name)
3. The `buildIcon` function is replaced with a `createMarkerOverlay` function that returns an OverlayView instance
4. Highlight state changes the border color and slightly scales the marker
5. Click and hover handlers are attached to the HTML element directly

### Modified Files

| File | Change |
|------|--------|
| `src/components/TripMap.tsx` | Replace Marker-based rendering with custom OverlayView HTML markers; add tag-to-icon mapping; update highlight logic to change overlay styles |

### No new dependencies
- Uses native Google Maps OverlayView API
- Icons rendered as inline SVG paths (from Lucide icon set, embedded as simple path data to avoid React dependency in the overlay HTML)
