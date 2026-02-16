import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Trash2, Calendar, DollarSign, CalendarRange } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { RoamlyLogo } from "@/components/RoamlyLogo";
import { UserMenu } from "@/components/UserMenu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { DayPlan, TripConfig } from "@/data/demoTrip";

export default function MyTrips() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleOpen = (trip: NonNullable<typeof trips>[number]) => {
    const config = trip.trip_config as unknown as TripConfig;
    navigate("/plan", {
      state: {
        ...config,
        savedTripId: trip.id,
        savedItinerary: trip.itinerary as unknown as DayPlan[],
        savedPreferences: trip.preferences,
      },
    });
  };

  const handleDelete = async (tripId: string) => {
    const { error } = await supabase.from("trips").delete().eq("id", tripId);
    if (error) {
      toast.error("Failed to delete trip");
    } else {
      toast.success("Trip deleted");
      queryClient.invalidateQueries({ queryKey: ["trips", user?.id] });
    }
  };

  if (!authLoading && !user) {
    navigate("/");
    return null;
  }

  const stopCount = (itinerary: unknown) => {
    try {
      const days = itinerary as DayPlan[];
      return days.reduce((sum, d) => sum + (d.stops?.length || 0), 0);
    } catch {
      return 0;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="shrink-0">
              <RoamlyLogo size="md" className="text-primary" />
            </button>
          </div>
          <UserMenu />
        </div>
      </nav>

      <main className="pt-28 pb-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-display font-bold text-primary">My Trips</h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : !trips || trips.length === 0 ? (
          <div className="text-center py-20">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-display font-semibold text-primary mb-2">No saved trips yet</h2>
            <p className="text-muted-foreground font-body mb-6">Plan a trip and save it to see it here.</p>
            <Button onClick={() => navigate("/")} className="bg-accent text-accent-foreground hover:bg-accent/90 font-body">
              Plan a Trip
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip, i) => {
              const config = trip.trip_config as unknown as TripConfig;
              return (
                <motion.div
                  key={trip.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => handleOpen(trip)}
                >
                  <div className="p-5">
                    <h3 className="font-display font-semibold text-lg text-primary mb-1 truncate">{trip.title}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-body mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {config?.startDate && config?.endDate ? `${format(parseISO(config.startDate), "MMM d")} – ${format(parseISO(config.endDate), "MMM d")}` : config?.days || "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> {config?.budget || "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {stopCount(trip.itinerary)} stops
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-body">
                      {new Date(trip.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="px-5 pb-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(trip.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
