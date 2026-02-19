import { CalendarDays, MapPin } from "lucide-react";
import { ActivityImage } from "@/components/ActivityImage";
import { type DayPlan } from "@/data/demoTrip";

interface ItineraryGridPanelProps {
  itinerary: DayPlan[];
  destination?: string;
  onOpenDayOnMap?: (dayNumber: number) => void;
}

function DayCardTile({
  day,
  destination,
  onOpenDayOnMap,
}: {
  day: DayPlan;
  destination?: string;
  onOpenDayOnMap?: (dayNumber: number) => void;
}) {
  const featuredStop = day.stops[0];

  return (
    <button
      type="button"
      onClick={() => onOpenDayOnMap?.(day.day)}
      className="group w-full rounded-2xl border border-border/60 bg-card/80 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        {featuredStop ? (
          <ActivityImage
            activity={featuredStop.name}
            destination={destination}
            imageUrl={featuredStop.imageUrl}
            lat={featuredStop.lat}
            lng={featuredStop.lng}
            tags={featuredStop.tags}
            description={featuredStop.description}
            alt={featuredStop.name}
            className="h-40 w-full rounded-xl border border-border/50"
            imgClassName="object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/40 text-sm font-body text-muted-foreground">
            No activities yet
          </div>
        )}
        <span
          className="absolute left-2.5 top-2.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-body font-bold text-primary-foreground shadow-sm"
          style={{ background: day.color }}
        >
          {day.day}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-body uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Day {day.day}
        </div>
        <p className="line-clamp-2 text-sm font-body font-semibold text-foreground">
          {day.title}
        </p>
        <p className="line-clamp-2 text-xs font-body text-muted-foreground">
          {featuredStop ? featuredStop.name : "Add an activity for this day"}
        </p>
        <div className="inline-flex items-center gap-1 text-[11px] font-body font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
          <MapPin className="h-3 w-3" />
          Open on map
        </div>
      </div>
    </button>
  );
}

export function ItineraryGridPanel({ itinerary, destination, onOpenDayOnMap }: ItineraryGridPanelProps) {
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(95%_80%_at_0%_0%,hsl(var(--accent)/0.08),transparent_45%),radial-gradient(90%_80%_at_100%_0%,hsl(var(--primary)/0.10),transparent_40%),hsl(var(--background))] p-4">
      <div className="mb-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2 backdrop-blur-sm">
        <p className="text-[11px] font-body uppercase tracking-wide text-muted-foreground">Itinerary Grid</p>
        <p className="text-sm font-body font-semibold text-foreground">Day-by-day highlights</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {itinerary.map((day) => (
          <DayCardTile
            key={day.day}
            day={day}
            destination={destination}
            onOpenDayOnMap={onOpenDayOnMap}
          />
        ))}
      </div>
    </div>
  );
}
