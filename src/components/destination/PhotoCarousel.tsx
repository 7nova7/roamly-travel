import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGoogleMaps } from "@/lib/google-maps";
import { Camera } from "lucide-react";

interface PhotoCarouselProps {
  stopName: string;
  lat: number;
  lng: number;
}

export function PhotoCarousel({ stopName, lat, lng }: PhotoCarouselProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setPhotos([]);

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMaps();
        const gm = (window as any).google.maps;
        const service = new gm.places.PlacesService(document.createElement("div"));

        // First try findPlaceFromQuery for best match
        const request = {
          query: stopName,
          fields: ["place_id"],
          locationBias: new gm.LatLng(lat, lng),
        };

        service.findPlaceFromQuery(request, (results: any[], status: string) => {
          if (cancelled) return;
          if (status !== gm.places.PlacesServiceStatus.OK || !results?.[0]?.place_id) {
            setLoading(false);
            return;
          }

          // Get place details with photos
          service.getDetails(
            { placeId: results[0].place_id, fields: ["photos"] },
            (place: any, detailStatus: string) => {
              if (cancelled) return;
              if (detailStatus !== gm.places.PlacesServiceStatus.OK || !place?.photos?.length) {
                setLoading(false);
                return;
              }

              const urls = place.photos
                .slice(0, 6)
                .map((photo: any) => photo.getUrl({ maxWidth: 600, maxHeight: 400 }));

              setPhotos(urls);
              setLoading(false);
            }
          );
        });
      } catch (err) {
        console.error("Failed to load place photos:", err);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [stopName, lat, lng]);

  if (!loading && photos.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-xl bg-secondary/40">
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <Camera className="w-5 h-5" />
          <span className="text-xs font-body">No photos available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {loading
          ? [1, 2, 3].map((i) => (
              <Skeleton key={i} className="shrink-0 w-44 h-28 rounded-xl" />
            ))
          : photos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${stopName} photo ${i + 1}`}
                className="shrink-0 w-44 h-28 rounded-xl object-cover snap-start border border-border shadow-sm"
                loading="lazy"
              />
            ))}
      </div>
    </div>
  );
}
