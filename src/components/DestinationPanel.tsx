import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, MapPin, Clock, DollarSign, Utensils, Building2, Compass, Info, Map } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { loadGoogleMaps } from "@/lib/google-maps";
import { PhotoCarousel } from "@/components/destination/PhotoCarousel";
import { PlacePhoto } from "@/components/destination/PlacePhoto";

interface DestinationDetails {
  overview: {
    description: string;
    bestTimeToVisit: string;
    knownFor: string[];
    safetyTips: string;
    language: string;
    currency: string;
  };
  restaurants: {
    name: string;
    cuisine: string;
    priceRange: string;
    rating: number;
    description: string;
    address: string;
  }[];
  stays: {
    name: string;
    type: string;
    priceRange: string;
    rating: number;
    neighborhood: string;
    description: string;
  }[];
  thingsToDo: {
    name: string;
    category: string;
    price: string;
    rating: number;
    description: string;
  }[];
  location: {
    lat: number;
    lng: number;
    formattedAddress: string;
    region: string;
  };
}

interface DestinationPanelProps {
  stop: { name: string; lat: number; lng: number } | null;
  onClose: () => void;
}

export function DestinationPanel({ stop, onClose }: DestinationPanelProps) {
  const [details, setDetails] = useState<DestinationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const miniMapRef = useRef<HTMLDivElement>(null);
  const miniMapInstance = useRef<any>(null);

  useEffect(() => {
    if (!stop) {
      setDetails(null);
      return;
    }
    setLoading(true);
    setDetails(null);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-destination-details", {
          body: { name: stop.name, lat: stop.lat, lng: stop.lng },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setDetails(data);
      } catch (err: any) {
        console.error("Failed to load destination details:", err);
        toast({ title: "Failed to load details", description: err?.message || "Please try again.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [stop, toast]);

  // Mini map for Location tab
  useEffect(() => {
    if (!details?.location || !miniMapRef.current) return;
    loadGoogleMaps().then(() => {
      if (!miniMapRef.current) return;
      const gm = (window as any).google.maps;
      const pos = { lat: details.location.lat, lng: details.location.lng };
      miniMapInstance.current = new gm.Map(miniMapRef.current, {
        center: pos,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
      new gm.Marker({ position: pos, map: miniMapInstance.current, title: stop?.name });
    });
    return () => { miniMapInstance.current = null; };
  }, [details?.location, stop?.name]);

  if (!stop) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute inset-0 z-30 bg-card flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-foreground truncate">{stop.name}</h2>
            {details?.location?.region && (
              <p className="text-sm font-body text-muted-foreground mt-0.5">{details.location.region}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0 ml-3">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 mb-0 bg-secondary/60 shrink-0">
            <TabsTrigger value="overview" className="text-xs font-body gap-1"><Info className="w-3 h-3" /> Overview</TabsTrigger>
            <TabsTrigger value="restaurants" className="text-xs font-body gap-1"><Utensils className="w-3 h-3" /> Eat</TabsTrigger>
            <TabsTrigger value="stays" className="text-xs font-body gap-1"><Building2 className="w-3 h-3" /> Stay</TabsTrigger>
            <TabsTrigger value="thingsToDo" className="text-xs font-body gap-1"><Compass className="w-3 h-3" /> Do</TabsTrigger>
            <TabsTrigger value="location" className="text-xs font-body gap-1"><Map className="w-3 h-3" /> Map</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-3 space-y-4">
              {/* Photo carousel loads independently */}
              <PhotoCarousel stopName={stop.name} lat={stop.lat} lng={stop.lng} />
              {loading ? <OverviewSkeleton /> : details?.overview && (
                <>
                  <p className="text-sm font-body text-foreground leading-relaxed whitespace-pre-line">{details.overview.description}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoCard icon={<Clock className="w-4 h-4 text-accent" />} label="Best Time" value={details.overview.bestTimeToVisit} />
                    <InfoCard icon={<DollarSign className="w-4 h-4 text-accent" />} label="Currency" value={details.overview.currency} />
                  </div>
                  <div>
                    <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">Known For</p>
                    <div className="flex flex-wrap gap-1.5">
                      {details.overview.knownFor.map(item => (
                        <span key={item} className="px-2.5 py-1 rounded-full text-xs font-body bg-accent/10 text-accent-foreground">{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3">
                    <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tips</p>
                    <p className="text-xs font-body text-foreground leading-relaxed">{details.overview.safetyTips}</p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Restaurants Tab */}
            <TabsContent value="restaurants" className="mt-3 space-y-3">
              {loading ? <CardListSkeleton /> : details?.restaurants.map((r, i) => (
                <PlaceCard
                  key={i}
                  name={r.name}
                  subtitle={r.cuisine}
                  meta={r.address}
                  price={r.priceRange}
                  rating={r.rating}
                  description={r.description}
                  stopLat={stop!.lat}
                  stopLng={stop!.lng}
                />
              ))}
            </TabsContent>

            {/* Stays Tab */}
            <TabsContent value="stays" className="mt-3 space-y-3">
              {loading ? <CardListSkeleton /> : details?.stays.map((s, i) => (
                <PlaceCard
                  key={i}
                  name={s.name}
                  subtitle={s.type}
                  meta={s.neighborhood}
                  price={s.priceRange}
                  rating={s.rating}
                  description={s.description}
                  stopLat={stop!.lat}
                  stopLng={stop!.lng}
                />
              ))}
            </TabsContent>

            {/* Things to Do Tab */}
            <TabsContent value="thingsToDo" className="mt-3 space-y-3">
              {loading ? <CardListSkeleton /> : details?.thingsToDo.map((t, i) => (
                <PlaceCard
                  key={i}
                  name={t.name}
                  subtitle={t.category}
                  price={t.price}
                  rating={t.rating}
                  description={t.description}
                  stopLat={stop!.lat}
                  stopLng={stop!.lng}
                />
              ))}
            </TabsContent>

            {/* Location Tab */}
            <TabsContent value="location" className="mt-3">
              {loading ? (
                <Skeleton className="w-full h-64 rounded-xl" />
              ) : (
                <div className="space-y-3">
                  <div ref={miniMapRef} className="w-full h-64 rounded-xl overflow-hidden border border-border" />
                  {details?.location && (
                    <div className="flex items-start gap-2 text-sm font-body text-muted-foreground">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                      <span>{details.location.formattedAddress}</span>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </motion.div>
    </AnimatePresence>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-xl p-3 flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-body font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= Math.round(rating) ? "text-accent fill-accent" : "text-border"}`}
        />
      ))}
      <span className="text-xs font-body text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function PlaceCard({ name, subtitle, meta, price, rating, description, stopLat, stopLng }: {
  name: string;
  subtitle: string;
  meta?: string;
  price: string;
  rating: number;
  description: string;
  stopLat: number;
  stopLng: number;
}) {
  return (
    <div className="bg-secondary/40 rounded-xl p-3.5 hover:bg-secondary/60 transition-colors flex gap-3">
      <PlacePhoto placeName={name} lat={stopLat} lng={stopLng} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <h4 className="font-body font-semibold text-sm text-foreground truncate">{name}</h4>
            <p className="text-xs font-body text-muted-foreground">{subtitle}</p>
          </div>
          <span className="text-xs font-body font-semibold text-accent shrink-0">{price}</span>
        </div>
        <RatingStars rating={rating} />
        <p className="text-xs font-body text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{description}</p>
        {meta && (
          <div className="flex items-center gap-1 mt-2 text-[10px] font-body text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{meta}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[75%]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-6 w-20 rounded-full" />)}
      </div>
    </div>
  );
}

function CardListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
