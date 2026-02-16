import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps";

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  iconClassName?: string;
}

export function PlacesAutocomplete({ value, onChange, placeholder, iconClassName = "text-muted-foreground" }: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadTriggered = useRef(false);

  const triggerLoad = useCallback(() => {
    if (loadTriggered.current) return;
    loadTriggered.current = true;
    loadGoogleMaps().then(() => setIsLoaded(true)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const gm = (window as any).google.maps;
    const autocomplete = new gm.places.Autocomplete(inputRef.current, {
      types: ["(cities)"],
      fields: ["formatted_address", "name", "geometry"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place?.name) {
        onChange(place.formatted_address || place.name);
      }
    });

    autocompleteRef.current = autocomplete;
  }, [isLoaded, onChange]);

  return (
    <div className="relative">
      <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${iconClassName}`} />
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={triggerLoad}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm font-body ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}