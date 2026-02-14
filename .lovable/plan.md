

# Roamly — AI-Powered Road Trip Optimizer

## Brand & Design System
- **Color palette**: Deep forest green (#1B4332) primary, warm amber (#F4A261) accents, soft warm white (#FAFAF7) backgrounds
- **Typography**: Plus Jakarta Sans for body, Playfair Display for headings/logo
- **Logo**: "Roamly" rendered in display font with a compass/route-pin accent on the "o" via CSS/SVG
- **Overall mood**: Premium consumer travel-tech, inspired by Mindtrip.com meets Apple Maps

---

## VIEW 1: Landing Page + Trip Setup

### Hero Section
- Large headline: "Your AI road trip strategist" with tagline
- Inline trip input form with fields: starting point, destination, trip length (pill selector), travel dates (optional date range picker), budget pills ($–$$$), and travel mode icon pills (Car, RV, Motorcycle)
- Big amber "Plan My Trip →" CTA with scale + glow micro-interaction
- Subtle animated gradient or travel photo background with overlay

### Below the Fold
- "How Roamly Works" — 3-step section with icons (Tell us your trip → We learn what you love → Get an optimized itinerary)
- Social proof section with placeholder testimonials and avatar placeholders
- Minimal footer
- Smooth fade-in-on-scroll animations for all sections

---

## VIEW 2: Trip Planning Workspace

### Layout
- **Desktop**: Split-screen — left panel (45-50%) for AI chat + itinerary, right panel (50-55%) for interactive map, with resizable drag handle
- **Tablet**: Map collapses to top 35%, chat below
- **Mobile**: Collapsible map top bar with show/hide toggle, chat as primary view, fixed bottom input bar

### Top Navigation Bar
- Roamly logo (left), trip summary pill e.g. "Seattle → Portland | 3 days | $$" (center), "New Trip" button + user avatar placeholder (right)

### Left Panel — AI Chat & Itinerary

**Phase 1: Preference Discovery (hardcoded demo flow)**
- Chat UI with clean message bubbles, Roamly compass avatar, typing indicator animation
- Conversational flow: greeting → interest selection (clickable emoji pills like 🥾 Hiking, 🍺 Breweries, etc.) → day pace selector (Relaxed / Balanced / Adventure-packed) → must-see spots text input → loading animation with route-drawing visual

**Phase 2: Itinerary Display**
- Day-by-day cards in the chat flow (Day 1: Seattle to Centralia, Day 2: Centralia to Columbia River Gorge, Day 3: Hood River to Portland)
- Each card: header with route icon, vertical timeline of stops with time, name, AI description, photo thumbnail, tags (hours, drive time, cost), and Remove/Swap buttons
- Driving time indicators between stops
- Card footer with total driving time, stop count, estimated cost
- Quick action chips below: "Add more stops", "Make it more relaxed", "Swap Day 1 and 2", "Find restaurants near stops"
- All hardcoded with the provided Seattle → Portland demo data

### Right Panel — Interactive Map
- **Leaflet.js with OpenStreetMap tiles** (functional, free, swappable to Google Maps later)
- Numbered pin markers at real coordinates for all demo stops
- Route line connecting stops in order
- Day-colored pins (Day 1 = green, Day 2 = blue, Day 3 = amber)
- Floating zoom controls and day color legend
- Hover interaction: hovering a stop card highlights its map pin, and vice versa
- Pin drop animation when itinerary loads

---

## Micro-interactions & Polish
- Smooth page transitions between landing and workspace (fade/slide)
- Chat bubbles slide up with staggered delay
- Card hover: lift shadow + slight scale
- Skeleton loading states for cards during "generation"
- Smooth auto-scroll when new chat content appears
- All transitions targeting 60fps, buttery smooth
- "Roamly remembers your preferences" subtle badge/tooltip

---

## Responsive Design
- Desktop (1024px+): Full split-screen
- Tablet (768-1023px): Map top 35%, chat below
- Mobile (<768px): Collapsible map, chat primary, 44px minimum touch targets, fixed bottom input bar

## Technical Approach
- React + TypeScript + Tailwind CSS
- Leaflet.js for interactive map
- All data hardcoded/mocked with provided demo data
- Fully functional clickable prototype with the complete demo conversation flow
- Mobile-first priority

