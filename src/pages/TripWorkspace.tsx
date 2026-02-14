import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Map, MessageSquare, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoamlyLogo } from "@/components/RoamlyLogo";
import { ChatPanel } from "@/components/ChatPanel";
import { TripMap } from "@/components/TripMap";
import { DestinationPanel } from "@/components/DestinationPanel";
import { type DayPlan, type TripConfig } from "@/data/demoTrip";
import { useIsMobile } from "@/hooks/use-mobile";

export default function TripWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [highlightedStop, setHighlightedStop] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState<DayPlan[] | null>(null);
  const [showMap, setShowMap] = useState(!isMobile);
  const [focusedDay, setFocusedDay] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<{ name: string; lat: number; lng: number } | null>(null);

  const handleStopClick = (name: string, lat: number, lng: number) => {
    setSelectedStop({ name, lat, lng });
  };

  const tripConfig: TripConfig = location.state || { from: "Unknown", to: "Unknown", days: "Weekend", budget: "$$", mode: "Car" };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <nav className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card z-20">
        <button onClick={() => navigate("/")} className="shrink-0">
          <RoamlyLogo size="sm" className="text-primary" />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary text-xs font-body font-medium text-foreground">
          {tripConfig.from} → {tripConfig.to} | {tripConfig.days} | {tripConfig.budget}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="font-body text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> New Trip
          </Button>
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-body font-bold">U</div>
        </div>
      </nav>

      {/* Mobile map toggle */}
      {isMobile && (
        <button
          onClick={() => setShowMap(!showMap)}
          className="flex items-center justify-center gap-2 py-2.5 bg-secondary border-b border-border text-sm font-body font-medium text-foreground z-10"
        >
          {showMap ? <MessageSquare className="w-4 h-4" /> : <Map className="w-4 h-4" />}
          {showMap ? "Show Chat" : "Show Map"}
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {!isMobile ? (
          <>
            <div className="w-[45%] min-w-[360px] border-r border-border overflow-hidden">
              <ChatPanel
                tripConfig={tripConfig}
                onHighlightStop={setHighlightedStop}
                highlightedStop={highlightedStop}
                onItineraryReady={setItinerary}
                onDayClick={setFocusedDay}
                onStopClick={handleStopClick}
              />
            </div>
            <div className="flex-1 relative">
              <TripMap itinerary={itinerary} highlightedStop={highlightedStop} onHighlightStop={setHighlightedStop} focusedDay={focusedDay} onResetFocus={() => setFocusedDay(null)} onStopClick={handleStopClick} />
              <DestinationPanel stop={selectedStop} onClose={() => setSelectedStop(null)} />
            </div>
          </>
        ) : (
          <>
            <div className={`flex-1 relative ${showMap ? '' : 'hidden'}`}>
              <TripMap itinerary={itinerary} highlightedStop={highlightedStop} onHighlightStop={setHighlightedStop} focusedDay={focusedDay} onResetFocus={() => setFocusedDay(null)} onStopClick={handleStopClick} />
              <DestinationPanel stop={selectedStop} onClose={() => setSelectedStop(null)} />
            </div>
            <div className={`flex-1 overflow-hidden ${showMap ? 'hidden' : ''}`}>
              <ChatPanel
                tripConfig={tripConfig}
                onHighlightStop={setHighlightedStop}
                highlightedStop={highlightedStop}
                onItineraryReady={setItinerary}
                onDayClick={(day) => { setFocusedDay(day); setShowMap(true); }}
                onStopClick={(name, lat, lng) => { handleStopClick(name, lat, lng); setShowMap(true); }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
