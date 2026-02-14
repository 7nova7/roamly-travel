

# Match Reference Map Styling — Vibrant, Colorful Google Maps

## What Changes

Update the Google Maps style array in `TripMap.tsx` to produce a vibrant, richly colored map that closely matches the reference screenshot. The current styling is too muted and washed out — the reference shows:

- **Vivid teal-blue water** (not pale blue)
- **Rich saturated greens** for parks and natural areas
- **Warm sandy/tan terrain** for landscape
- **Yellow-orange highways** with clear road hierarchy
- **Visible labeled cities** with clean dark text
- **Subtle building footprints** in urban areas

## Visual Targets (from reference)

| Feature | Current | Target |
|---------|---------|--------|
| Water | Pale sky blue `#a8d4f0` | Rich teal-blue `#73c2e3` |
| Parks/forests | Soft mint `#c8e6c0` | Saturated green `#a3d9a5` with darker forests `#7ec882` |
| Landscape | Warm cream `#f5f0e8` | Warmer sand `#f0ead6` |
| Highways | White | Warm amber `#f5d076` with orange stroke |
| Arterial roads | Off-white | Light warm white with visible strokes |
| City labels | Muted `#4a4540` | Darker, bolder `#333333` |
| Country/state borders | Default | Subtle visible lines |

## Technical Details

### File Modified

**`src/components/TripMap.tsx`** — Replace the `styles` array (lines 40-70) with an expanded, more vibrant color palette:

- Water geometry uses richer blue tones
- Natural landscape uses warmer tan/sand
- Parks use saturated greens
- Highways get a subtle warm yellow fill with tan stroke (like Apple Maps)
- Arterial and local roads remain clean but with visible warm-toned strokes
- Administrative boundaries and labels are more visible
- POI parks remain visible; other POIs stay hidden
- Transit stays hidden for cleanliness

No new files or dependencies — only the styles array changes.

