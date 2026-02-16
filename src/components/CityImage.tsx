import { useEffect, useMemo, useState } from "react";

interface CityImageProps {
  city: string;
  region?: string;
  size: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}

const cityImageCache = new Map<string, string>();

const CITY_WIKI_TITLES: Record<string, string> = {
  "New York City": "New York City",
  "San Francisco": "San Francisco",
  Chicago: "Chicago",
  "Los Angeles": "Los Angeles",
  Austin: "Austin, Texas",
  Miami: "Miami",
  Seattle: "Seattle",
  "New Orleans": "New Orleans",
  Nashville: "Nashville, Tennessee",
  Denver: "Denver",
  Boston: "Boston",
  Portland: "Portland, Oregon",
  "Las Vegas": "Las Vegas",
  Phoenix: "Phoenix, Arizona",
  "San Diego": "San Diego",
  Toronto: "Toronto",
  Vancouver: "Vancouver",
  Montreal: "Montreal",
  "Mexico City": "Mexico City",
  Guadalajara: "Guadalajara",
  Cancun: "Cancún",
  London: "London",
  Paris: "Paris",
  Barcelona: "Barcelona",
  Rome: "Rome",
  Amsterdam: "Amsterdam",
  Lisbon: "Lisbon",
  Prague: "Prague",
  Vienna: "Vienna",
  Budapest: "Budapest",
  Berlin: "Berlin",
  Athens: "Athens",
  Istanbul: "Istanbul",
  Marrakesh: "Marrakesh",
  "Cape Town": "Cape Town",
  Tokyo: "Tokyo",
  Kyoto: "Kyoto",
  Seoul: "Seoul",
  Bangkok: "Bangkok",
  Singapore: "Singapore",
  Sydney: "Sydney",
  Melbourne: "Melbourne",
  Auckland: "Auckland",
};

function getWikiTitle(city: string) {
  return CITY_WIKI_TITLES[city] || city;
}

function parseSize(size: string) {
  const [w, h] = size.split("x").map((v) => Number.parseInt(v, 10));
  return {
    width: Number.isFinite(w) ? w : 800,
    height: Number.isFinite(h) ? h : 500,
  };
}

export function CityImage({ city, region, size, alt, className, imgClassName }: CityImageProps) {
  const key = useMemo(() => `${city}-${region || "city"}-${size}`, [city, region, size]);
  const cached = cityImageCache.get(key);
  const [src, setSrc] = useState<string | null>(cached || null);
  const { width } = parseSize(size);

  useEffect(() => {
    if (src) return;
    const controller = new AbortController();

    (async () => {
      try {
        const title = getWikiTitle(city);
        const url = new URL("https://en.wikipedia.org/w/api.php");
        url.searchParams.set("action", "query");
        url.searchParams.set("format", "json");
        url.searchParams.set("origin", "*");
        url.searchParams.set("prop", "pageimages");
        url.searchParams.set("redirects", "1");
        url.searchParams.set("titles", title);
        url.searchParams.set("pithumbsize", String(width));

        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error("Image lookup failed");
        const data = await res.json();
        const pages = data?.query?.pages;
        const firstPage = pages ? pages[Object.keys(pages)[0]] : null;
        const imageSrc = firstPage?.thumbnail?.source as string | undefined;
        if (imageSrc) {
          cityImageCache.set(key, imageSrc);
          setSrc(imageSrc);
          return;
        }

        const commonsQueries = [`${title} skyline`, `${title} cityscape`, `${title} city`];
        for (const query of commonsQueries) {
          const commonsUrl = new URL("https://commons.wikimedia.org/w/api.php");
          commonsUrl.searchParams.set("action", "query");
          commonsUrl.searchParams.set("format", "json");
          commonsUrl.searchParams.set("origin", "*");
          commonsUrl.searchParams.set("generator", "search");
          commonsUrl.searchParams.set("gsrsearch", query);
          commonsUrl.searchParams.set("gsrnamespace", "6");
          commonsUrl.searchParams.set("gsrlimit", "1");
          commonsUrl.searchParams.set("prop", "imageinfo");
          commonsUrl.searchParams.set("iiprop", "url");
          commonsUrl.searchParams.set("iiurlwidth", String(width));

          const commonsRes = await fetch(commonsUrl.toString(), { signal: controller.signal });
          if (!commonsRes.ok) continue;
          const commonsData = await commonsRes.json();
          const commonsPages = commonsData?.query?.pages;
          const commonsFirst = commonsPages ? commonsPages[Object.keys(commonsPages)[0]] : null;
          const commonsImage = commonsFirst?.imageinfo?.[0]?.thumburl || commonsFirst?.imageinfo?.[0]?.url;
          if (commonsImage) {
            cityImageCache.set(key, commonsImage);
            setSrc(commonsImage);
            return;
          }
        }

        setSrc(null);
      } catch {
        setSrc(null);
      }
    })();

    return () => controller.abort();
  }, [city, region, width, key, src]);

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      {!src && <div className="absolute inset-0 bg-secondary animate-pulse" />}
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover ${imgClassName || ""}`}
        />
      )}
    </div>
  );
}
