import { useEffect, useMemo, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";

interface ActivityImageProps {
  activity: string;
  destination?: string;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  description?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}

interface GeoPoint {
  lat: number;
  lng: number;
}

interface PlacePhotoLike {
  getUrl: (options?: { maxWidth?: number; maxHeight?: number }) => string;
}

interface PlaceGeometryLike {
  location?: {
    lat: number | (() => number);
    lng: number | (() => number);
  };
}

interface PlaceResultLike {
  place_id?: string;
  name?: string;
  photos?: PlacePhotoLike[];
  geometry?: PlaceGeometryLike;
}

interface GeocodeResultLike {
  geometry?: PlaceGeometryLike;
}

interface GooglePlacesServiceLike {
  textSearch: (
    request: { query: string; location?: GeoPoint; radius?: number },
    callback: (results: PlaceResultLike[] | null, status: string) => void,
  ) => void;
  nearbySearch: (
    request: { location: GeoPoint; radius: number; keyword?: string },
    callback: (results: PlaceResultLike[] | null, status: string) => void,
  ) => void;
}

interface GoogleMapsPlacesLike {
  Geocoder?: new () => {
    geocode: (
      request: { address: string },
      callback: (results: GeocodeResultLike[] | null, status: string) => void,
    ) => void;
  };
  places?: {
    PlacesService: new (container: Element) => GooglePlacesServiceLike;
    PlacesServiceStatus: {
      OK: string;
    };
  };
}

const activityImageCache = new Map<string, string>();
const failedImageSources = new Set<string>();
const destinationCenterCache = new Map<string, GeoPoint | null>();
const destinationCenterPending = new Map<string, Promise<GeoPoint | null>>();
const destinationImageCache = new Map<string, string | null>();

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value).split(" ").filter(Boolean);
}

function normalizeActivityName(value: string): string {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NOISE_TOKENS = new Set([
  "final",
  "musing",
  "moment",
  "moments",
  "stop",
  "experience",
  "session",
  "sessions",
  "day",
  "night",
  "trip",
  "tour",
  "adventure",
  "activity",
  "main",
  "character",
]);

function extractMeaningfulTokens(value: string): string[] {
  return tokenize(value).filter((token) => token.length > 2 && !NOISE_TOKENS.has(token));
}

function toNumber(value: number | (() => number) | undefined): number | null {
  if (typeof value === "function") {
    const resolved = value();
    return Number.isFinite(resolved) ? resolved : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function toGeoPoint(location: PlaceGeometryLike["location"] | undefined): GeoPoint | null {
  if (!location) return null;
  const lat = toNumber(location.lat);
  const lng = toNumber(location.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function resolvePointHint(lat?: number, lng?: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat as number, lng: lng as number };
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const earthRadiusKm = 6371;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function extractPhotoUrl(result: PlaceResultLike | undefined): string | null {
  if (!result?.photos?.length) return null;
  const photo = result.photos[0];
  if (!photo?.getUrl) return null;
  try {
    return photo.getUrl({ maxWidth: 640, maxHeight: 420 });
  } catch {
    return null;
  }
}

function buildQueries(activity: string, destination?: string): string[] {
  const cleanedActivity = normalizeActivityName(activity);
  const city = destination?.trim();
  const coreTokens = extractMeaningfulTokens(cleanedActivity).slice(0, 4);
  const simplifiedActivity = coreTokens.join(" ").trim();
  const queries = [
    city ? `${cleanedActivity} ${city}` : cleanedActivity,
    city && simplifiedActivity ? `${simplifiedActivity} ${city}` : simplifiedActivity,
    city ? `${activity} ${city}` : activity,
    cleanedActivity,
    simplifiedActivity,
  ].filter((q): q is string => Boolean(q && q.trim()));
  return Array.from(new Set(queries));
}

function normalizeDestinationLabel(destination?: string): string | null {
  const raw = destination?.trim();
  if (!raw) return null;
  const firstSegment = raw.split(",")[0]?.trim();
  return firstSegment || raw;
}

function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const bSet = new Set(b);
  const hits = a.filter((token) => bSet.has(token)).length;
  return hits / a.length;
}

function hasStrongNameMatch(activity: string, candidateName: string): boolean {
  const activityTokens = tokenize(activity).filter((token) => token.length > 2);
  const candidateTokens = tokenize(candidateName);
  if (!activityTokens.length) return true;

  const overlap = tokenOverlap(activityTokens, candidateTokens);
  if (overlap >= 0.34) return true;

  const compactActivity = normalizeText(activity);
  const compactCandidate = normalizeText(candidateName);
  if (compactCandidate.includes(compactActivity) || compactActivity.includes(compactCandidate)) return true;

  return false;
}

function isWithinCityBounds(
  candidatePoint: GeoPoint | null,
  stopPoint: GeoPoint | null,
  destinationCenter: GeoPoint | null,
): boolean {
  if (!candidatePoint) return false;

  if (stopPoint) {
    const stopDistance = haversineKm(stopPoint, candidatePoint);
    if (stopDistance > 18) return false;
  }

  if (destinationCenter) {
    const cityDistance = haversineKm(destinationCenter, candidatePoint);
    if (cityDistance > 40) return false;
  }

  return true;
}

function scoreCandidate(
  candidate: PlaceResultLike,
  activity: string,
  stopPoint: GeoPoint | null,
  destinationCenter: GeoPoint | null,
): number {
  const photo = extractPhotoUrl(candidate);
  if (!photo) return Number.NEGATIVE_INFINITY;

  const name = candidate.name || "";
  if (!hasStrongNameMatch(activity, name)) return Number.NEGATIVE_INFINITY;

  const point = toGeoPoint(candidate.geometry?.location);
  if (!isWithinCityBounds(point, stopPoint, destinationCenter)) return Number.NEGATIVE_INFINITY;

  const activityTokens = extractMeaningfulTokens(activity);
  const candidateTokens = tokenize(name);

  let score = 10;
  score += tokenOverlap(activityTokens, candidateTokens) * 20;

  if (stopPoint && point) {
    const distance = haversineKm(stopPoint, point);
    if (distance <= 0.3) score += 14;
    else if (distance <= 1) score += 10;
    else if (distance <= 3) score += 6;
    else score += Math.max(0, 4 - distance);
  }

  if (!stopPoint && destinationCenter && point) {
    const cityDistance = haversineKm(destinationCenter, point);
    if (cityDistance <= 3) score += 8;
    else if (cityDistance <= 8) score += 4;
  }

  return score;
}

function scoreRelaxedCandidate(
  candidate: PlaceResultLike,
  activity: string,
  stopPoint: GeoPoint | null,
  destinationCenter: GeoPoint | null,
): number {
  const photo = extractPhotoUrl(candidate);
  if (!photo) return Number.NEGATIVE_INFINITY;

  const name = candidate.name || "";
  const point = toGeoPoint(candidate.geometry?.location);
  if (!isWithinCityBounds(point, stopPoint, destinationCenter)) return Number.NEGATIVE_INFINITY;

  const activityTokens = extractMeaningfulTokens(activity);
  const candidateTokens = tokenize(name);
  const overlap = tokenOverlap(activityTokens, candidateTokens);

  let score = 5 + overlap * 10;
  if (activityTokens.length && overlap === 0) score -= 2;

  if (stopPoint && point) {
    const distance = haversineKm(stopPoint, point);
    if (distance <= 0.5) score += 6;
    else if (distance <= 2) score += 3;
  }

  return score;
}

async function runTextSearch(
  service: GooglePlacesServiceLike,
  maps: GoogleMapsPlacesLike,
  request: { query: string; location?: GeoPoint; radius?: number },
): Promise<PlaceResultLike[]> {
  return new Promise((resolve) => {
    service.textSearch(request, (results, status) => {
      if (status !== maps.places?.PlacesServiceStatus.OK || !results?.length) {
        resolve([]);
        return;
      }
      resolve(results);
    });
  });
}

async function runNearbySearch(
  service: GooglePlacesServiceLike,
  maps: GoogleMapsPlacesLike,
  request: { location: GeoPoint; radius: number; keyword?: string },
): Promise<PlaceResultLike[]> {
  return new Promise((resolve) => {
    service.nearbySearch(request, (results, status) => {
      if (status !== maps.places?.PlacesServiceStatus.OK || !results?.length) {
        resolve([]);
        return;
      }
      resolve(results);
    });
  });
}

async function getDestinationCenter(maps: GoogleMapsPlacesLike, destination?: string): Promise<GeoPoint | null> {
  const city = destination?.trim();
  if (!city || !maps.Geocoder) return null;

  if (destinationCenterCache.has(city)) {
    return destinationCenterCache.get(city) ?? null;
  }
  if (destinationCenterPending.has(city)) {
    return destinationCenterPending.get(city) ?? null;
  }

  const pending = new Promise<GeoPoint | null>((resolve) => {
    const geocoder = new maps.Geocoder!();
    geocoder.geocode({ address: city }, (results, status) => {
      const location = results?.[0]?.geometry?.location;
      if (status !== "OK" || !location) {
        destinationCenterCache.set(city, null);
        resolve(null);
        return;
      }
      const point = toGeoPoint(location);
      destinationCenterCache.set(city, point);
      resolve(point);
    });
  }).finally(() => {
    destinationCenterPending.delete(city);
  });

  destinationCenterPending.set(city, pending);
  return pending;
}

function dedupeCandidates(candidates: PlaceResultLike[]): PlaceResultLike[] {
  const deduped = new Map<string, PlaceResultLike>();
  candidates.forEach((candidate, index) => {
    const key = candidate.place_id || `${normalizeText(candidate.name || "place")}::${index}`;
    if (!deduped.has(key)) deduped.set(key, candidate);
  });
  return Array.from(deduped.values());
}

function pickNearestLocalPhoto(
  candidates: PlaceResultLike[],
  stopPoint: GeoPoint | null,
  destinationCenter: GeoPoint | null,
): string | null {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPhoto: string | null = null;

  for (const candidate of candidates) {
    const photo = extractPhotoUrl(candidate);
    if (!photo) continue;

    const point = toGeoPoint(candidate.geometry?.location);
    if (!isWithinCityBounds(point, stopPoint, destinationCenter)) continue;

    const distance = stopPoint && point
      ? haversineKm(stopPoint, point)
      : destinationCenter && point
        ? haversineKm(destinationCenter, point)
        : 0;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPhoto = photo;
    }
  }

  return bestPhoto;
}

async function findBestGooglePhoto(
  activity: string,
  destination: string | undefined,
  stopPoint: GeoPoint | null,
  tags: string[],
  description: string | undefined,
): Promise<string | null> {
  try {
    await loadGoogleMaps();
  } catch {
    return null;
  }

  const maps = (window as Window & { google?: { maps?: GoogleMapsPlacesLike } }).google?.maps;
  if (!maps?.places) return null;

  const destinationCenter = await getDestinationCenter(maps, destination);
  const service = new maps.places.PlacesService(document.createElement("div"));
  const queries = buildQueries(activity, destination);
  const searchCenter = stopPoint || destinationCenter;
  const collected: PlaceResultLike[] = [];

  if (stopPoint) {
    const nearby = await runNearbySearch(service, maps, {
      location: stopPoint,
      radius: 4500,
      keyword: normalizeActivityName(activity),
    });
    collected.push(...nearby);
  }

  for (const query of queries) {
    if (searchCenter) {
      const biased = await runTextSearch(service, maps, {
        query,
        location: searchCenter,
        radius: stopPoint ? 15000 : 28000,
      });
      collected.push(...biased);
    }
  }

  const globalQuery = queries[0] || activity;
  const globalResults = await runTextSearch(service, maps, { query: globalQuery });
  collected.push(...globalResults);

  const candidates = dedupeCandidates(collected);
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestPhoto: string | null = null;

  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, activity, stopPoint, destinationCenter);
    if (score <= bestScore) continue;
    const photo = extractPhotoUrl(candidate);
    if (!photo) continue;
    bestScore = score;
    bestPhoto = photo;
  }

  if (bestScore >= 14 && bestPhoto) return bestPhoto;

  let relaxedBestScore = Number.NEGATIVE_INFINITY;
  let relaxedBestPhoto: string | null = null;
  for (const candidate of candidates) {
    const score = scoreRelaxedCandidate(candidate, activity, stopPoint, destinationCenter);
    if (score <= relaxedBestScore) continue;
    const photo = extractPhotoUrl(candidate);
    if (!photo) continue;
    relaxedBestScore = score;
    relaxedBestPhoto = photo;
  }

  if (relaxedBestScore >= 5 && relaxedBestPhoto) return relaxedBestPhoto;

  const nearestLocalPhoto = pickNearestLocalPhoto(candidates, stopPoint, destinationCenter);
  if (nearestLocalPhoto) return nearestLocalPhoto;

  if (stopPoint) {
    const broadNearby = await runNearbySearch(service, maps, {
      location: stopPoint,
      radius: 3200,
    });
    const broadCandidates = dedupeCandidates(broadNearby);
    const broadLocalPhoto = pickNearestLocalPhoto(broadCandidates, stopPoint, destinationCenter);
    if (broadLocalPhoto) return broadLocalPhoto;
  }

  const themedQueries = Array.from(new Set([
    destination ? `${destination} ${tags[0] || "travel"}` : "",
    destination && description ? `${destination} ${extractMeaningfulTokens(description).slice(0, 2).join(" ")}` : "",
    destination ? `${destination} travel` : "",
    destination ? `${destination} landmark` : "",
  ])).filter((query): query is string => Boolean(query && query.trim()));

  for (const query of themedQueries) {
    const themedResults = await runTextSearch(service, maps, searchCenter
      ? { query, location: searchCenter, radius: 28000 }
      : { query });
    const themedCandidates = dedupeCandidates(themedResults);
    const themedPhoto = pickFirstInCityWithPhoto(themedCandidates, destinationCenter);
    if (themedPhoto) return themedPhoto;
  }

  return null;
}

function pickFirstInCityWithPhoto(candidates: PlaceResultLike[], destinationCenter: GeoPoint | null): string | null {
  for (const candidate of candidates) {
    const photo = extractPhotoUrl(candidate);
    if (!photo) continue;
    if (!destinationCenter) return photo;
    const point = toGeoPoint(candidate.geometry?.location);
    if (!point) continue;
    if (haversineKm(destinationCenter, point) <= 50) return photo;
  }
  return null;
}

function getWikipediaThumbnail(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const query = (data as Record<string, unknown>).query;
  if (!query || typeof query !== "object") return null;
  const pages = (query as Record<string, unknown>).pages;
  if (!pages || typeof pages !== "object") return null;
  const records = Object.values(pages as Record<string, unknown>);
  for (const page of records) {
    if (!page || typeof page !== "object") continue;
    const thumbnail = (page as Record<string, unknown>).thumbnail;
    if (!thumbnail || typeof thumbnail !== "object") continue;
    const source = (thumbnail as Record<string, unknown>).source;
    if (typeof source === "string" && source) return source;
  }
  return null;
}

function getCommonsImage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const query = (data as Record<string, unknown>).query;
  if (!query || typeof query !== "object") return null;
  const pages = (query as Record<string, unknown>).pages;
  if (!pages || typeof pages !== "object") return null;
  const records = Object.values(pages as Record<string, unknown>);
  for (const page of records) {
    if (!page || typeof page !== "object") continue;
    const imageInfo = (page as Record<string, unknown>).imageinfo;
    if (!Array.isArray(imageInfo) || imageInfo.length === 0) continue;
    const first = imageInfo[0];
    if (!first || typeof first !== "object") continue;
    const thumb = (first as Record<string, unknown>).thumburl;
    if (typeof thumb === "string" && thumb) return thumb;
    const url = (first as Record<string, unknown>).url;
    if (typeof url === "string" && url) return url;
  }
  return null;
}

async function fetchWikipediaSearchImage(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", trimmed);
    url.searchParams.set("gsrlimit", "4");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("pithumbsize", "640");
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = await response.json();
    return getWikipediaThumbnail(data);
  } catch {
    return null;
  }
}

async function fetchCommonsSearchImage(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", trimmed);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "4");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url");
    url.searchParams.set("iiurlwidth", "640");
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = await response.json();
    return getCommonsImage(data);
  } catch {
    return null;
  }
}

async function fetchWikipediaTitleImage(title: string): Promise<string | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;

  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("redirects", "1");
    url.searchParams.set("titles", trimmed);
    url.searchParams.set("pithumbsize", "640");

    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = await response.json();
    return getWikipediaThumbnail(data);
  } catch {
    return null;
  }
}

async function findDestinationFallbackImage(destination?: string): Promise<string | null> {
  const label = normalizeDestinationLabel(destination);
  if (!label) return null;

  if (destinationImageCache.has(label)) {
    return destinationImageCache.get(label) ?? null;
  }

  const titleImage = await fetchWikipediaTitleImage(label);
  if (titleImage) {
    destinationImageCache.set(label, titleImage);
    return titleImage;
  }

  const queries = [
    `${label} skyline`,
    `${label} cityscape`,
    `${label} downtown`,
    `${label} city`,
  ];

  for (const query of queries) {
    const commonsImage = await fetchCommonsSearchImage(query);
    if (commonsImage) {
      destinationImageCache.set(label, commonsImage);
      return commonsImage;
    }
  }

  return null;
}

async function findEncyclopediaImage(activity: string, destination?: string): Promise<string | null> {
  const queries = buildQueries(activity, destination);
  if (destination?.trim()) queries.push(destination.trim());

  for (const query of Array.from(new Set(queries))) {
    const wiki = await fetchWikipediaSearchImage(query);
    if (wiki) return wiki;
    const commons = await fetchCommonsSearchImage(query);
    if (commons) return commons;
  }

  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

function withHealthySources(values: Array<string | null | undefined>): string[] {
  return uniqueStrings(values).filter((source) => !failedImageSources.has(source));
}

export function ActivityImage({
  activity,
  destination,
  imageUrl,
  lat,
  lng,
  tags = [],
  description,
  alt,
  className,
  imgClassName,
}: ActivityImageProps) {
  const stopPoint = useMemo(() => resolvePointHint(lat, lng), [lat, lng]);
  const tagsKey = useMemo(() => tags.join("|"), [tags]);
  const normalizedTags = useMemo(() => tagsKey.split("|").filter(Boolean), [tagsKey]);
  const cacheKey = useMemo(
    () =>
      `${activity}::${destination || "any"}::${stopPoint ? `${stopPoint.lat.toFixed(4)},${stopPoint.lng.toFixed(4)}` : "no-point"}`,
    [activity, destination, stopPoint],
  );
  const cachedPrimary = activityImageCache.get(cacheKey) || null;
  const primarySource = imageUrl || cachedPrimary;
  const [sourceList, setSourceList] = useState<string[]>(
    withHealthySources([primarySource]),
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const [isResolving, setIsResolving] = useState(Boolean(!primarySource));
  const [primaryFailed, setPrimaryFailed] = useState(false);

  useEffect(() => {
    setPrimaryFailed(false);
  }, [cacheKey, primarySource]);

  useEffect(() => {
    let cancelled = false;
    setSourceIndex(0);

    if (primarySource && !primaryFailed) {
      activityImageCache.set(cacheKey, primarySource);
      setSourceList(withHealthySources([primarySource]));
      setIsResolving(false);
      return () => {
        cancelled = true;
      };
    }

    setIsResolving(true);
    void (async () => {
      const googlePhoto = await findBestGooglePhoto(activity, destination, stopPoint, normalizedTags, description);
      if (cancelled) return;

      let resolved = googlePhoto;
      if (!resolved) {
        resolved = await findEncyclopediaImage(activity, destination);
      }
      if (!resolved) {
        resolved = await findDestinationFallbackImage(destination);
      }
      if (cancelled) return;

      if (resolved) {
        activityImageCache.set(cacheKey, resolved);
      }
      setSourceList(withHealthySources([resolved]));
      setSourceIndex(0);
      setIsResolving(false);
    })().catch(() => {
      if (cancelled) return;
      setSourceList([]);
      setSourceIndex(0);
      setIsResolving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activity, cacheKey, description, destination, normalizedTags, primaryFailed, primarySource, stopPoint]);

  const currentSrc = sourceList[sourceIndex] || null;

  return (
    <div className={`relative overflow-hidden bg-secondary/50 ${className || ""}`}>
      {isResolving && <div className="absolute inset-0 animate-pulse bg-secondary" />}

      {currentSrc ? (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover ${imgClassName || ""}`}
          onLoad={() => {
            const loaded = sourceList[sourceIndex];
            if (!loaded) return;
            activityImageCache.set(cacheKey, loaded);
          }}
          onError={() => {
            const failed = sourceList[sourceIndex];
            if (failed) failedImageSources.add(failed);
            if (sourceIndex < sourceList.length - 1) {
              setSourceIndex(sourceIndex + 1);
              return;
            }
            if (primarySource && !primaryFailed) {
              setPrimaryFailed(true);
              setIsResolving(true);
              return;
            }
            setSourceList([]);
          }}
        />
      ) : (
        !isResolving && (
          <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
            <span className="text-[11px] font-body text-muted-foreground/80 line-clamp-2">{normalizeActivityName(activity)}</span>
          </div>
        )
      )}
    </div>
  );
}
