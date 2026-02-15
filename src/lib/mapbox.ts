import { supabase } from "@/integrations/supabase/client";

let tokenPromise: Promise<string> | null = null;

export function getMapboxToken(): Promise<string> {
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    const { data, error } = await supabase.functions.invoke("get-mapbox-token");
    if (error || data?.error) throw new Error(data?.error || error?.message || "Failed to get Mapbox token");
    return data.token as string;
  })();

  return tokenPromise;
}

export const MAPBOX_STYLES = [
  { id: "outdoors", label: "Outdoors", url: "mapbox://styles/mapbox/outdoors-v12", emoji: "🏔️" },
  { id: "streets", label: "Streets", url: "mapbox://styles/mapbox/streets-v12", emoji: "🗺️" },
  { id: "satellite", label: "Satellite", url: "mapbox://styles/mapbox/satellite-v9", emoji: "🛰️" },
  { id: "satellite-streets", label: "Satellite Streets", url: "mapbox://styles/mapbox/satellite-streets-v12", emoji: "🌍" },
  { id: "terrain", label: "Terrain", url: "mapbox://styles/mapbox/outdoors-v12", emoji: "⛰️" },
] as const;
