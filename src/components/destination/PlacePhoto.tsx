import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGoogleMaps } from "@/lib/google-maps";
import { ImageOff } from "lucide-react";

interface PlacePhotoProps {
  placeName: string;
  lat: number;
  lng: number;
}

export function PlacePhoto({ placeName, lat, lng }: PlacePhotoProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPhotoUrl(null);
    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMaps();
        const gm = (window as any).google.maps;
        const service = new gm.places.PlacesService(document.createElement("div"));

        service.findPlaceFromQuery(
          { query: placeName, fields: ["place_id"], locationBias: new gm.LatLng(lat, lng) },
          (results: any[], status: string) => {
            if (cancelled) return;
            if (status !== gm.places.PlacesServiceStatus.OK || !results?.[0]?.place_id) {
              setLoading(false);
              return;
            }
            service.getDetails(
              { placeId: results[0].place_id, fields: ["photos"] },
              (place: any, ds: string) => {
                if (cancelled) return;
                if (ds === gm.places.PlacesServiceStatus.OK && place?.photos?.length) {
                  setPhotoUrl(place.photos[0].getUrl({ maxWidth: 200, maxHeight: 200 }));
                }
                setLoading(false);
              }
            );
          }
        );
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [placeName, lat, lng]);

  if (loading) {
    return <Skeleton className="w-20 h-20 rounded-xl shrink-0" />;
  }

  if (!photoUrl) {
    return (
      <div className="w-20 h-20 rounded-xl shrink-0 bg-secondary/60 flex items-center justify-center">
        <ImageOff className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={placeName}
      className="w-20 h-20 rounded-xl shrink-0 object-cover border border-border"
      loading="lazy"
    />
  );
}
