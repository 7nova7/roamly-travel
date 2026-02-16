

# Mobile: Chat-First Experience with Map Button

## What Changes

On mobile, the app currently defaults to showing the map immediately. Instead, it will:

1. **Always start on the Chat view** -- so you go through the full conversation (interests, pace, must-sees) and see the generated itinerary first.
2. **Remove the always-visible toggle bar** at the top that currently lets you flip between Map and Chat at any time.
3. **Show a prominent "Show Map" button only after the itinerary is ready** -- placed as a sticky bottom bar on mobile so it's easy to tap once you've reviewed your plan.
4. When viewing the map, a "Back to Chat" button appears in the same position to return.

## Technical Details

### `src/pages/TripWorkspace.tsx`

- Change `showMap` initial state from `!isMobile` to `false` (always start on chat).
- Remove the old toggle bar (lines 98-107).
- Add a new sticky bottom bar for mobile that only appears when `itinerary` exists:
  - Shows "View on Map" with a Map icon when chat is visible
  - Shows "Back to Chat" with a MessageSquare icon when map is visible
  - Styled as a prominent, full-width button at the bottom of the screen
- Keep the existing behavior where tapping a day/stop in the chat auto-switches to map view (lines 144-146) -- this still works naturally.

### No other files need changes

The ChatPanel and TripMap components remain untouched. The only change is in TripWorkspace controlling when the map toggle appears and defaulting to chat-first.

