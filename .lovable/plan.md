

# Animated Destination Carousel on Landing Page

## What You'll Get

A horizontally auto-scrolling carousel of destination cards placed directly below the "Plan My Trip" button. Each card shows a beautiful city photo with the trip title overlaid. The cards scroll continuously in a marquee-style animation, and clicking any card navigates to the trip workspace where the AI automatically generates an itinerary for that destination.

## Destination Cards

Each card will include:
- A high-quality Unsplash photo of the city (loaded via URL, no local assets needed)
- A trip title overlay at the bottom (e.g., "A NYC Classic", "Urban Adventure in Tokyo")
- Rounded corners matching the reference screenshot style

The list will include 16+ destinations spanning the globe:
- New York, Tokyo, Paris, Barcelona, London, Cancun, Toronto, Rome, Bali, Sydney, Dubai, Marrakech, Reykjavik, Cape Town, Bangkok, Lisbon, and more

## Animation

- Two rows scrolling in opposite directions (row 1 left-to-right, row 2 right-to-left) for visual interest
- CSS keyframe marquee animation -- smooth, infinite, and performant (no JS timers)
- The card list is duplicated so the scroll loops seamlessly without gaps
- Animation pauses on hover so users can click a card easily
- Full-width overflow hidden container so cards appear and disappear at the edges

## Click Behavior

When a user clicks a destination card, it navigates to `/plan` with pre-filled state:
- `from`: a sensible origin (e.g., "Your Location")
- `to`: the destination city
- `days`: a preset trip length per destination (e.g., "Weekend", "Full week")
- `budget`: "No limit"
- `mode`: "Plane" for international, "Car" for domestic

The trip workspace then auto-generates the itinerary via AI as it normally would.

## Placement

Inserted between the trip form card and the "How Roamly Works" section -- right after the hero section closes.

## Technical Details

### New File: `src/components/DestinationCarousel.tsx`
- Contains the destination data array (city name, title, Unsplash image URL, trip config)
- Renders two scrolling rows using CSS `@keyframes` animation on a flex container
- Each card is an `<a>`-like clickable element using `useNavigate`
- Cards are ~280px wide, ~200px tall with rounded-2xl corners and a gradient overlay for text readability
- The card list is rendered twice (concatenated) to create the seamless loop effect

### Modified File: `src/pages/LandingPage.tsx`
- Import and render `<DestinationCarousel />` between the hero section and "How it works" section

### CSS Animation (in component via Tailwind arbitrary values or inline style)
```
@keyframes scroll-left {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes scroll-right {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0); }
}
```
Duration ~40-60s for a smooth, leisurely scroll.

### No backend changes needed
All destination data is hardcoded. The existing `/plan` route and AI itinerary generation handle everything once the user lands on the workspace.
