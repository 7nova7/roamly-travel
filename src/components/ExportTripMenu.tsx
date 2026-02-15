import { Download, ExternalLink, MapPin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DayPlan, type TripConfig } from "@/data/demoTrip";
import { toast } from "sonner";

interface ExportTripMenuProps {
  itinerary: DayPlan[];
  tripConfig: TripConfig;
}

function exportToGoogleMaps(itinerary: DayPlan[]) {
  for (const day of itinerary) {
    if (day.stops.length === 0) continue;
    // Google Maps supports ~10 waypoints per URL
    const chunks: typeof day.stops[] = [];
    for (let i = 0; i < day.stops.length; i += 10) {
      chunks.push(day.stops.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const path = chunk.map((s) => `${s.lat},${s.lng}`).join("/");
      window.open(`https://www.google.com/maps/dir/${path}`, "_blank");
    }
  }
  toast.success("Opened in Google Maps");
}

function exportToKML(itinerary: DayPlan[], tripConfig: TripConfig) {
  const folders = itinerary
    .map(
      (day) => `
    <Folder>
      <name>Day ${day.day} - ${day.title}</name>
      ${day.stops
        .map(
          (s) => `
      <Placemark>
        <name>${escapeXml(s.name)}</name>
        <description>${escapeXml(s.description)}</description>
        <Point>
          <coordinates>${s.lng},${s.lat},0</coordinates>
        </Point>
      </Placemark>`
        )
        .join("")}
    </Folder>`
    )
    .join("");

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Trip: ${escapeXml(tripConfig.from)} to ${escapeXml(tripConfig.to)}</name>${folders}
  </Document>
</kml>`;

  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trip-${tripConfig.from}-to-${tripConfig.to}.kml`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("KML file downloaded");
}

function escapeXml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function shareTrip() {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: "My Trip on Roamly", url });
      return;
    } catch {
      // user cancelled or not supported
    }
  }
  await navigator.clipboard.writeText(url);
  toast.success("Link copied to clipboard");
}

export function ExportTripMenu({ itinerary, tripConfig }: ExportTripMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="font-body text-xs gap-1">
          <ExternalLink className="w-3.5 h-3.5" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => exportToGoogleMaps(itinerary)} className="gap-2 cursor-pointer">
          <MapPin className="w-4 h-4" /> Open in Google Maps
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToKML(itinerary, tripConfig)} className="gap-2 cursor-pointer">
          <Download className="w-4 h-4" /> Download KML File
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareTrip()} className="gap-2 cursor-pointer">
          <Share2 className="w-4 h-4" /> Copy Share Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
