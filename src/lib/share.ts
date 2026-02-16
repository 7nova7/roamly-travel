import type { DayPlan, TripConfig } from "@/data/demoTrip";

export type ShareTripData = {
  v: 1;
  tripConfig: TripConfig;
  itinerary: DayPlan[];
  preferences?: { interests: string[]; pace: string; mustSees: string };
};

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
  const binary = atob(base64 + pad);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShareData(data: ShareTripData): string {
  return toBase64Url(JSON.stringify(data));
}

export function decodeShareData(search: string): ShareTripData | null {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get("share");
    if (!raw) return null;
    const json = fromBase64Url(raw);
    const parsed = JSON.parse(json) as ShareTripData;
    if (!parsed || parsed.v !== 1 || !parsed.tripConfig || !Array.isArray(parsed.itinerary)) return null;
    return parsed;
  } catch {
    return null;
  }
}
