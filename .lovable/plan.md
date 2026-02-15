

# Export Trip to Mobile / Google Maps

## Overview

Add an "Export" button to the trip workspace that lets users share their itinerary in three ways:

1. **Open in Google Maps** -- generates a Google Maps directions URL with all stops as waypoints, openable on any phone
2. **Download KML file** -- produces a standard KML file importable into Google Maps (My Maps), Google Earth, or any GPS app
3. **Share link** -- copies a shareable URL so users can view the trip on their phone's browser

## How Each Export Works

### 1. Google Maps Directions Link
Builds a URL like `https://www.google.com/maps/dir/Stop+1/Stop+2/Stop+3/...` using lat/lng coordinates. When opened on a phone, it launches the Google Maps app with turn-by-turn navigation for the full route. Google Maps supports up to 10 waypoints per URL, so multi-day trips will generate one link per day.

### 2. KML File Download
Generates a `.kml` XML file containing all stops as placemarks with names, descriptions, and coordinates. Users can:
- Import it into Google Maps via "My Maps" on desktop, then access it on the Google Maps mobile app
- Open it directly in Google Earth on their phone
- Load it into any GPS/navigation app that supports KML

### 3. Share / Copy Link
Uses the browser's native Share API (available on mobile) or copies the current trip URL to clipboard. This lets users text or email the trip to themselves.

## UI Design

A floating "Export" button appears in the top-right area of the map (or in the nav bar). Clicking it opens a small dropdown/dialog with three options:

```text
+----------------------------------+
|  Export Trip                     |
|                                  |
|  [map pin icon]  Open in Google Maps   |
|  [download icon] Download KML File     |
|  [share icon]    Copy Share Link       |
+----------------------------------+
```

On mobile, the Share option uses the native share sheet (navigator.share).

## Technical Details

### New File: `src/components/ExportTripMenu.tsx`
- Accepts `itinerary: DayPlan[]` and `tripConfig: TripConfig` as props
- Contains three export functions:
  - `exportToGoogleMaps(dayStops)` -- builds and opens the directions URL
  - `exportToKML(itinerary)` -- generates KML XML string, creates a Blob, and triggers download
  - `shareTrip()` -- uses `navigator.share()` with fallback to `navigator.clipboard.writeText()`

### Modified File: `src/pages/TripWorkspace.tsx`
- Import and render `ExportTripMenu` in the nav bar (next to "New Trip" button), visible only when an itinerary exists

### Modified File: `src/components/TripMap.tsx`
- No changes needed -- the export menu lives outside the map

### Google Maps URL Format
```
https://www.google.com/maps/dir/{lat1},{lng1}/{lat2},{lng2}/{lat3},{lng3}/...
```
If a day has more than 10 stops, it splits into multiple links.

### KML Generation (no library needed)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Trip: Austin to Denver</name>
    <Folder>
      <name>Day 1 - Hill Country</name>
      <Placemark>
        <name>Stop Name</name>
        <description>Stop description</description>
        <Point>
          <coordinates>-97.74,30.27,0</coordinates>
        </Point>
      </Placemark>
    </Folder>
  </Document>
</kml>
```

### No new dependencies or backend changes required
Everything is generated client-side using browser APIs.

