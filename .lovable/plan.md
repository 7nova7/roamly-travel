# Fix Destination Carousel: Remove "Your Location" and Fix Images

## Changes

### 1. Update `src/components/DestinationCarousel.tsx`

**Remove "Your Location"**: Change the `from` field for every destination to match the destination city itself (e.g., `from: "New York"` and `to: "New York"`). This way the trip reads as a local itinerary exploring that city and its surroundings, and the nav bar will show something like "New York → New York | Full week" instead of "Your Location → New York".

**Fix broken Unsplash images**: Replace image URLs that may be broken or return errors. Specifically:

- Lisbon: replace `photo-1558618666-fcd25c85f82e` with a verified working Lisbon photo (`photo-1585208798174-6cedd86e019a`)
- Buenos Aires: replace `photo-1589909202802-8f4aadce1849` with a verified working photo (`photo-1612294037637-ec328d0e075e`)
- Reykjavik: replace `photo-1504829857797-ddff29c27927` with a verified Iceland photo (`photo-1529963183134-61a90db47eaf`)
- Marrakech: replace `photo-1597212618440-806262de4f6b` with a verified Marrakech photo (`photo-1489749798305-4fea3ae63d43`)

### 2. Update `src/components/ChatPanel.tsx`

Adjust the greeting message so that when `from` equals `to`, it says "exploring {city}" instead of "trip from {city} to {city}". For example: "I'm planning your full week exploring New York."

## Technical Details

- `DestinationCarousel.tsx`: Change all `handleClick` calls to pass `from: dest.city` instead of `from: "Your Location"`
- `ChatPanel.tsx` line 61: Add a conditional -- if `tripConfig.from === tripConfig.to`, use the wording `"trip exploring ${tripConfig.to}"` instead of `"trip from ${tripConfig.from} to ${tripConfig.to}"`
- Replace 4 Unsplash photo IDs with known-working alternatives
- No backend or dependency changes needed  
  
  
3. Ensure there is a fair mix of "full week" and "weekend trip" 