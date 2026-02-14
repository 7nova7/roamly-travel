

# Add Real Photos to Place Cards (Eat, Stay, Do)

## What Changes

Each place card in the Eat, Stay, and Do tabs will display a photo fetched from the Google Places API. The same approach already used in the `PhotoCarousel` component will be reused -- `findPlaceFromQuery` to match the place name, then `getDetails` to grab a photo URL.

## Visual Design

Each `PlaceCard` will gain a thumbnail image on the left side:

```text
+-------+-------------------------------+
|       |  Restaurant Name      $$$     |
| photo |  Italian                      |
| 80x80 |  ★★★★☆ 4.2                   |
|       |  Description text...          |
+-------+-------------------------------+
```

- 80x80px rounded thumbnail on the left
- Falls back to a subtle icon placeholder if no photo is found
- Skeleton placeholder while loading

## Technical Details

### File: `src/components/destination/PlacePhoto.tsx` (new)

A small standalone component that:
- Accepts `placeName` and `locationBias` (lat/lng from the parent stop)
- Uses the existing `loadGoogleMaps()` helper
- Calls `PlacesService.findPlaceFromQuery` with the place name + location bias
- Fetches the first photo via `getDetails` with `fields: ["photos"]`
- Renders a skeleton while loading, a fallback icon if no photo, or the photo

### File: `src/components/DestinationPanel.tsx` (modified)

- Pass `stopLat` and `stopLng` down to each `PlaceCard`
- Update `PlaceCard` layout to a horizontal flex with the photo on the left
- Import and render `PlacePhoto` inside each `PlaceCard`

### No new dependencies or backend changes needed

The Google Places API is already loaded via `loadGoogleMaps()` with the `places` library. This reuses the exact same pattern as the existing `PhotoCarousel`.

