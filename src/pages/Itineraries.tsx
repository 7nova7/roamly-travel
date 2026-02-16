import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RoamlyLogo } from "@/components/RoamlyLogo";
import { UserMenu } from "@/components/UserMenu";
import { useToast } from "@/hooks/use-toast";
import { getMapboxToken } from "@/lib/mapbox";
import type { DayPlan, Stop } from "@/data/demoTrip";
import { CityImage } from "@/components/CityImage";

type Duration = "All" | "Day trip" | "Weekend" | "Full week";

const durations: Duration[] = ["All", "Day trip", "Weekend", "Full week"];

const timeSlots = ["9:00 AM", "12:30 PM", "4:30 PM"];
const DAY_COLORS = ["#1B4332", "#2563EB", "#F4A261", "#D6336C", "#6D28D9", "#0D9488", "#EAB308"];

const exampleItineraries = [
  { city: "New York City", region: "USA", duration: "Weekend", theme: "Neighborhood bites + skyline", highlights: ["SoHo stroll", "High Line", "Brooklyn sunset"] },
  { city: "San Francisco", region: "USA", duration: "Day trip", theme: "Waterfront + hidden stairs", highlights: ["Ferry Building", "Lombard views", "Mission murals"] },
  { city: "Chicago", region: "USA", duration: "Weekend", theme: "Architecture + jazz", highlights: ["Riverwalk", "Loop classics", "Late-night set"] },
  { city: "Los Angeles", region: "USA", duration: "Full week", theme: "Beach towns + studios", highlights: ["Malibu coast", "Studio tour", "DTLA food"] },
  { city: "Austin", region: "USA", duration: "Day trip", theme: "Live music + BBQ", highlights: ["Food trucks", "South Congress", "Sunset bat bridge"] },
  { city: "Miami", region: "USA", duration: "Weekend", theme: "Art deco + sandbars", highlights: ["Ocean Drive", "Wynwood walls", "Key Biscayne"] },
  { city: "Seattle", region: "USA", duration: "Weekend", theme: "Coffee walks + ferries", highlights: ["Pike Place", "Ballard locks", "Bainbridge hop"] },
  { city: "New Orleans", region: "USA", duration: "Day trip", theme: "Garden District + beignets", highlights: ["Magazine St", "Jazz pocket", "French Quarter"] },
  { city: "Nashville", region: "USA", duration: "Weekend", theme: "Honky-tonks + hot chicken", highlights: ["Broadway bars", "East Nashville", "Ryman show"] },
  { city: "Denver", region: "USA", duration: "Weekend", theme: "Mountain foothills + breweries", highlights: ["Red Rocks", "LoHi bites", "Golden detour"] },
  { city: "Boston", region: "USA", duration: "Day trip", theme: "Freedom Trail + oysters", highlights: ["North End", "Public Garden", "Harbor walk"] },
  { city: "Portland", region: "USA", duration: "Weekend", theme: "Food carts + forests", highlights: ["Pearl District", "Forest Park", "Coffee crawl"] },
  { city: "Las Vegas", region: "USA", duration: "Weekend", theme: "Neon nights + canyon day", highlights: ["Strip loop", "Downtown bars", "Red Rock"] },
  { city: "Phoenix", region: "USA", duration: "Day trip", theme: "Desert hikes + murals", highlights: ["Camelback views", "Roosevelt Row", "Sonoran eats"] },
  { city: "San Diego", region: "USA", duration: "Weekend", theme: "Coastal parks + tacos", highlights: ["La Jolla", "Balboa Park", "Sunset Cliffs"] },
  { city: "Toronto", region: "Canada", duration: "Weekend", theme: "Waterfront + markets", highlights: ["Distillery District", "Island ferry", "Kensington"] },
  { city: "Vancouver", region: "Canada", duration: "Weekend", theme: "Seawall + mountain views", highlights: ["Stanley Park", "Granville", "Grouse skyride"] },
  { city: "Montreal", region: "Canada", duration: "Day trip", theme: "Old Port + bakeries", highlights: ["St. Paul St", "Mount Royal", "Bagel stop"] },
  { city: "Mexico City", region: "Mexico", duration: "Full week", theme: "Museums + mezcal bars", highlights: ["Chapultepec", "Roma Norte", "Coyoacan"] },
  { city: "Guadalajara", region: "Mexico", duration: "Weekend", theme: "Plazas + mariachi", highlights: ["Tlaquepaque", "Cathedral", "Mercado eats"] },
  { city: "Cancun", region: "Mexico", duration: "Day trip", theme: "Lagoon + street food", highlights: ["Laguna loop", "Centro snacks", "Beach sunset"] },
  { city: "London", region: "UK", duration: "Weekend", theme: "Markets + riverside", highlights: ["Borough Market", "South Bank", "Notting Hill"] },
  { city: "Paris", region: "France", duration: "Weekend", theme: "Bakeries + galleries", highlights: ["Le Marais", "Louvre loop", "Montmartre"] },
  { city: "Barcelona", region: "Spain", duration: "Weekend", theme: "Modernist trails + tapas", highlights: ["Eixample", "Park Guell", "Beach dusk"] },
  { city: "Rome", region: "Italy", duration: "Weekend", theme: "Piazzas + sunset viewpoints", highlights: ["Trastevere", "Colosseum", "Janiculum"] },
  { city: "Amsterdam", region: "Netherlands", duration: "Day trip", theme: "Canals + museums", highlights: ["Jordaan", "Museumplein", "Canal cruise"] },
  { city: "Lisbon", region: "Portugal", duration: "Weekend", theme: "Miradouros + trams", highlights: ["Alfama", "Belem", "LX Factory"] },
  { city: "Prague", region: "Czechia", duration: "Day trip", theme: "Old Town + riverside", highlights: ["Charles Bridge", "Castle views", "Cafe hop"] },
  { city: "Vienna", region: "Austria", duration: "Weekend", theme: "Cafes + palaces", highlights: ["Schonbrunn", "Ringstrasse", "Coffee house"] },
  { city: "Budapest", region: "Hungary", duration: "Weekend", theme: "Thermal baths + ruin bars", highlights: ["Buda Castle", "Szechenyi", "Gozsdu Court"] },
  { city: "Berlin", region: "Germany", duration: "Weekend", theme: "History + nightlife", highlights: ["Museum Island", "East Side", "Club night"] },
  { city: "Athens", region: "Greece", duration: "Day trip", theme: "Acropolis + tavernas", highlights: ["Plaka lanes", "Ancient Agora", "Rooftop views"] },
  { city: "Istanbul", region: "Turkey", duration: "Weekend", theme: "Bazaars + skyline teas", highlights: ["Grand Bazaar", "Galata", "Bosphorus"] },
  { city: "Marrakesh", region: "Morocco", duration: "Weekend", theme: "Souks + riads", highlights: ["Jemaa el-Fnaa", "Majorelle", "Medina alleys"] },
  { city: "Cape Town", region: "South Africa", duration: "Full week", theme: "Coastline + wine country", highlights: ["Table Mountain", "Cape Point", "Stellenbosch"] },
  { city: "Tokyo", region: "Japan", duration: "Full week", theme: "Neighborhood loops + ramen", highlights: ["Shibuya", "Asakusa", "Omoide Yokocho"] },
  { city: "Kyoto", region: "Japan", duration: "Weekend", theme: "Temples + bamboo groves", highlights: ["Fushimi Inari", "Arashiyama", "Gion night"] },
  { city: "Seoul", region: "South Korea", duration: "Weekend", theme: "Markets + design streets", highlights: ["Ikseon-dong", "Gwangjang", "Han River"] },
  { city: "Bangkok", region: "Thailand", duration: "Weekend", theme: "Canals + night markets", highlights: ["Chao Phraya", "Chinatown", "Asiatique"] },
  { city: "Singapore", region: "Singapore", duration: "Day trip", theme: "Gardens + hawker halls", highlights: ["Gardens by the Bay", "Maxwell", "Marina Bay"] },
  { city: "Sydney", region: "Australia", duration: "Weekend", theme: "Harbor walks + beaches", highlights: ["Opera House", "Bondi walk", "The Rocks"] },
  { city: "Melbourne", region: "Australia", duration: "Weekend", theme: "Laneways + coffee", highlights: ["Hosier Lane", "Fitzroy", "St Kilda"] },
  { city: "Auckland", region: "New Zealand", duration: "Day trip", theme: "Volcanic views + harbor", highlights: ["Mt Eden", "Viaduct", "Waiheke hop"] },
] as const;

type SampleStop = { time: string; label: string };
type SampleDay = { day: number; stops: SampleStop[] };

const toStops = (labels: string[], city: string): SampleStop[] => {
  const fallback = [`${city} city core walk`, "Market lunch", "Sunset viewpoint"];
  const list = labels.filter(Boolean);
  const useList = list.length > 0 ? list : fallback;
  return useList.slice(0, 3).map((label, i) => ({
    time: timeSlots[i] || "Anytime",
    label,
  }));
};

const buildSampleDays = (item: (typeof exampleItineraries)[number]): SampleDay[] => {
  const themeBits = item.theme.split("+").map((part) => part.trim()).filter(Boolean);
  const day1Stops = toStops(item.highlights, item.city);

  if (item.duration === "Day trip") {
    return [{ day: 1, stops: day1Stops }];
  }

  if (item.duration === "Weekend") {
    return [
      { day: 1, stops: day1Stops },
      { day: 2, stops: toStops([...themeBits, "Neighborhood loop", "Sunset spot"], item.city) },
    ];
  }

  return [
    { day: 1, stops: day1Stops },
    { day: 2, stops: toStops([...themeBits, "Neighborhood loop", "Food market"], item.city) },
    { day: 3, stops: toStops([`Day trip outside ${item.city}`, "Scenic stop", "Local dinner"], item.city) },
    { day: 4, stops: toStops(["Parks and gardens", "Gallery district", "Late-night bites"], item.city) },
    { day: 5, stops: toStops(["Slow morning", "Favorite return stop", "Souvenir stroll"], item.city) },
  ];
};

const pickTags = (text: string): string[] => {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  if (/(food|drink|taco|bbq|coffee|cafe|market|bakery|brewery|bar)/.test(lower)) tags.push("Food & Drink");
  if (/(park|beach|trail|garden|mountain|coast|lake|harbor|water|sunset|scenic)/.test(lower)) tags.push("Hiking & Nature");
  if (/(museum|history|heritage|castle|temple|church|gallery|art|culture)/.test(lower)) tags.push("History & Culture");
  if (/(music|nightlife|club|jazz|festival)/.test(lower)) tags.push("Nightlife");
  if (/(family|kids|zoo|aquarium)/.test(lower)) tags.push("Family Activities");
  if (tags.length === 0) tags.push("Photography Spots");
  return tags.slice(0, 2);
};

const buildItinerary = (item: (typeof exampleItineraries)[number], center: { lat: number; lng: number }): DayPlan[] => {
  const days = buildSampleDays(item);
  return days.map((dayPlan, dayIdx) => {
    const stops: Stop[] = dayPlan.stops.map((stop, stopIdx) => {
      const radius = 0.012 + dayIdx * 0.003 + stopIdx * 0.002;
      const angle = (dayIdx * 60 + stopIdx * 40) * (Math.PI / 180);
      const lat = center.lat + Math.cos(angle) * radius;
      const lng = center.lng + Math.sin(angle) * radius;
      const tags = pickTags(`${item.theme} ${stop.label}`);
      return {
        id: `${item.city}-${dayPlan.day}-${stopIdx}`,
        time: stop.time,
        name: stop.label,
        description: `A curated stop for your ${item.city} ${item.duration.toLowerCase()} itinerary.`,
        hours: "Hours vary",
        cost: stopIdx === 1 ? "$$" : "Free",
        driveFromPrev: stopIdx === 0 ? undefined : stopIdx === 1 ? "12m drive" : "9m drive",
        lat,
        lng,
        tags,
      };
    });

    const totalDriving = item.duration === "Day trip"
      ? "45m total travel"
      : item.duration === "Weekend"
        ? "1h 10m total travel"
        : "1h 30m total travel";

    const estimatedCost = item.duration === "Day trip"
      ? "$80"
      : item.duration === "Weekend"
        ? "$220"
        : "$540";

    return {
      day: dayPlan.day,
      title: dayIdx === 0 ? "City highlights" : dayIdx === 1 ? "Neighborhood loop" : "Slow discoveries",
      subtitle: item.theme,
      totalDriving,
      stops,
      estimatedCost,
      color: DAY_COLORS[dayIdx % DAY_COLORS.length],
    };
  });
};

export default function Itineraries() {
  const navigate = useNavigate();
  const [activeDuration, setActiveDuration] = useState<Duration>("All");
  const [loadingCard, setLoadingCard] = useState<string | null>(null);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const autoHandledRef = useRef(false);

  const openSample = useCallback(async (item: (typeof exampleItineraries)[number], cardId: string) => {
    setLoadingCard(cardId);
    let didNavigate = false;
    try {
      const token = await getMapboxToken();
      const query = `${item.city}, ${item.region}`;
      const resp = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1&types=place,locality`
      );
      if (!resp.ok) throw new Error("Unable to load location data");
      const data = await resp.json();
      const feature = data?.features?.[0];
      if (!feature?.center?.length) throw new Error("Location not found");
      const [lng, lat] = feature.center as [number, number];
      const itinerary = buildItinerary(item, { lat, lng });
      didNavigate = true;
      navigate("/plan", {
        state: {
          from: item.city,
          to: item.city,
          days: item.duration,
          budget: "$$",
          mode: "Car",
          savedItinerary: itinerary,
        },
      });
    } catch (err: any) {
      toast({
        title: "Couldn't open itinerary",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      if (!didNavigate) setLoadingCard(null);
    }
  }, [navigate, toast]);

  const filtered = useMemo(() => {
    if (activeDuration === "All") return exampleItineraries;
    return exampleItineraries.filter((item) => item.duration === activeDuration);
  }, [activeDuration]);

  useEffect(() => {
    if (autoHandledRef.current) return;
    const city = searchParams.get("city");
    const duration = searchParams.get("duration") as Duration | null;
    if (!city || !duration) return;

    autoHandledRef.current = true;
    if (durations.includes(duration)) setActiveDuration(duration);
    const match = exampleItineraries.find((item) => item.city === city && item.duration === duration);
    if (match) {
      const cardId = `${match.city}-${match.duration}`;
      openSample(match, cardId);
    } else {
      toast({
        title: "Itinerary not found",
        description: "Try another example or browse the list.",
        variant: "destructive",
      });
    }
  }, [searchParams, openSample, toast]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="shrink-0">
            <RoamlyLogo size="md" className="text-primary" />
          </button>
          <UserMenu />
        </div>
      </nav>

      <main className="pt-28 pb-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-display font-bold text-primary">Example itineraries</h1>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-sm font-body text-muted-foreground max-w-xl">
              Choose a trip length to see how Roamly shapes different cities into smooth, realistic days.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {durations.map((label) => (
              <button
                key={label}
                onClick={() => setActiveDuration(label)}
                className={`px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all ${
                  activeDuration === label
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border/70 hover:bg-secondary/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, i) => {
            const cardId = `${item.city}-${item.duration}`;
            const isLoading = loadingCard === cardId;
            return (
            <motion.div
              key={cardId}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i % 9) * 0.04 }}
              whileHover={{ y: -4 }}
              className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm"
            >
              <CityImage
                city={item.city}
                region={item.region}
                size="700x420"
                alt={`${item.city} itinerary`}
                className="w-full h-28 rounded-xl mb-3"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-body font-semibold text-foreground">{item.city}</p>
                  <p className="text-[11px] font-body text-muted-foreground">{item.region}</p>
                </div>
                <span className="text-[10px] font-body font-semibold text-accent-foreground bg-accent/10 px-2 py-1 rounded-full">
                  {item.duration}
                </span>
              </div>
              <p className="text-xs font-body text-muted-foreground mt-2">{item.theme}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {item.highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="text-[10px] font-body text-muted-foreground bg-secondary/60 px-2 py-1 rounded-full"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
              <button
                onClick={() => openSample(item, cardId)}
                className="mt-4 w-full flex items-center justify-center gap-2 text-xs font-body font-medium text-accent-foreground bg-accent/10 hover:bg-accent/20 transition-colors px-3 py-2 rounded-xl disabled:opacity-60"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                View sample itinerary
              </button>
            </motion.div>
          );})}
        </div>
      </main>
    </div>
  );
}
