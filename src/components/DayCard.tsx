import { useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import { Clock, Car, DollarSign, X, MapPin, Plus, GripVertical } from "lucide-react";
import type { DayPlan } from "@/data/demoTrip";

const DRAG_MIME_TYPE = "application/x-roamly-stop";

interface DayCardProps {
  day: DayPlan;
  onHighlightStop: (stopId: string | null) => void;
  highlightedStop: string | null;
  onDayClick?: (dayNumber: number) => void;
  isMapFocused?: boolean;
  onStopClick?: (name: string, lat: number, lng: number) => void;
  onStopZoom?: (lat: number, lng: number) => void;
  onDeleteStop?: (dayNumber: number, stopId: string) => void;
  onAddStop?: (dayNumber: number) => void;
  onMoveStop?: (move: { sourceDay: number; stopId: string; targetDay: number; targetStopId?: string }) => void;
}

export function DayCard({ day, onHighlightStop, highlightedStop, onDayClick, isMapFocused = false, onStopClick, onStopZoom, onDeleteStop, onAddStop, onMoveStop }: DayCardProps) {
  const [dragOverStopId, setDragOverStopId] = useState<string | null>(null);
  const [isDragOverDay, setIsDragOverDay] = useState(false);

  const readDragPayload = (event: DragEvent): { sourceDay: number; stopId: string } | null => {
    try {
      const raw = event.dataTransfer.getData(DRAG_MIME_TYPE) || event.dataTransfer.getData("text/plain");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { sourceDay?: number; stopId?: string };
      if (typeof parsed.sourceDay !== "number" || typeof parsed.stopId !== "string") return null;
      return { sourceDay: parsed.sourceDay, stopId: parsed.stopId };
    } catch {
      return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: day.day * 0.15 }}
      className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div
        onClick={() => onDayClick?.(day.day)}
        className={`px-4 py-3 border-b border-border/40 flex items-center gap-3 cursor-pointer transition-colors ${
          isMapFocused ? "bg-accent/10" : "hover:bg-secondary/30"
        }`}
        style={{ borderLeftWidth: 4, borderLeftColor: day.color }}
      >
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-body font-bold text-primary-foreground" style={{ background: day.color }}>
          {day.day}
        </div>
        <div className="flex-1">
          <h3 className="font-body font-semibold text-sm text-foreground">Day {day.day} — {day.title}</h3>
          <p className="text-xs text-muted-foreground font-body">{day.subtitle}</p>
        </div>
        <MapPin className={`w-3.5 h-3.5 shrink-0 ${isMapFocused ? "text-accent" : "text-muted-foreground"}`} />
      </div>

      {/* Stops timeline */}
      <div
        className={`px-4 py-3 space-y-1 transition-colors ${isDragOverDay ? "bg-accent/5" : ""}`}
        onDragOver={(e) => {
          if (!onMoveStop) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsDragOverDay(true);
        }}
        onDragLeave={() => {
          setIsDragOverDay(false);
        }}
        onDrop={(e) => {
          if (!onMoveStop) return;
          e.preventDefault();
          const payload = readDragPayload(e);
          if (!payload) return;
          onMoveStop({
            sourceDay: payload.sourceDay,
            stopId: payload.stopId,
            targetDay: day.day,
          });
          setDragOverStopId(null);
          setIsDragOverDay(false);
        }}
      >
        {day.stops.map((stop, i) => (
          <div key={stop.id}>
            {stop.driveFromPrev && (
              <div className="flex items-center gap-2 py-1.5 pl-6">
                <Car className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-body">{stop.driveFromPrev}</span>
              </div>
            )}
            <div
              draggable={Boolean(onMoveStop)}
              onDragStart={(e) => {
                if (!onMoveStop) return;
                const payload = JSON.stringify({ sourceDay: day.day, stopId: stop.id });
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData(DRAG_MIME_TYPE, payload);
                e.dataTransfer.setData("text/plain", payload);
              }}
              onDragEnd={() => {
                setDragOverStopId(null);
                setIsDragOverDay(false);
              }}
              onDragOver={(e) => {
                if (!onMoveStop) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                setDragOverStopId(stop.id);
                setIsDragOverDay(false);
              }}
              onDragLeave={(e) => {
                if (!onMoveStop) return;
                e.stopPropagation();
                if (dragOverStopId === stop.id) {
                  setDragOverStopId(null);
                }
              }}
              onDrop={(e) => {
                if (!onMoveStop) return;
                e.preventDefault();
                e.stopPropagation();
                const payload = readDragPayload(e);
                if (!payload) return;
                onMoveStop({
                  sourceDay: payload.sourceDay,
                  stopId: payload.stopId,
                  targetDay: day.day,
                  targetStopId: stop.id,
                });
                setDragOverStopId(null);
              }}
              onMouseEnter={() => onHighlightStop(stop.id)}
              onMouseLeave={() => onHighlightStop(null)}
              onClick={() => onStopZoom?.(stop.lat, stop.lng)}
              className={`group flex gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                highlightedStop === stop.id ? "bg-accent/10 shadow-sm" : "hover:bg-secondary/50"
              } ${
                dragOverStopId === stop.id ? "ring-2 ring-accent/50 bg-accent/10" : ""
              }`}
            >
              {onMoveStop && (
                <div className="shrink-0 text-muted-foreground mt-1">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-2.5 h-2.5 rounded-full border-2 mt-1" style={{ borderColor: day.color }} />
                {i < day.stops.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs text-muted-foreground font-body font-medium">{stop.time}</span>
                </div>
                <h4
                  className="font-body font-semibold text-sm text-foreground hover:text-accent cursor-pointer transition-colors"
                  onClick={(e) => { e.stopPropagation(); onStopClick?.(stop.name, stop.lat, stop.lng); }}
                >{stop.name}</h4>
                <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">{stop.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] font-body px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{stop.hours}</span>
                  <span className="text-[10px] font-body px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{stop.cost}</span>
                  {stop.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-body px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteStop?.(day.day, stop.id); }}
                  className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove activity"
                  title="Remove activity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {onAddStop && (
          <div className="pt-2">
            <button
              onClick={() => onAddStop(day.day)}
              className="w-full flex items-center justify-center gap-2 text-xs font-body font-medium px-3 py-2 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add activity
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border/40 flex items-center gap-4 text-xs text-muted-foreground font-body">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {day.totalDriving}</span>
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {day.stops.length} stops</span>
        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Est. {day.estimatedCost}</span>
      </div>
    </motion.div>
  );
}
