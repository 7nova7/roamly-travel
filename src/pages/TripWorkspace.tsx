import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Map, MessageSquare, Plus, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoamlyLogo } from "@/components/RoamlyLogo";
import { ChatPanel } from "@/components/ChatPanel";
import { TripMap } from "@/components/TripMap";
import { DestinationPanel } from "@/components/DestinationPanel";
import { ExportTripMenu } from "@/components/ExportTripMenu";
import { UserMenu } from "@/components/UserMenu";
import { AuthDialog } from "@/components/AuthDialog";
import { type DayPlan, type TripConfig } from "@/data/demoTrip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useSaveTrip } from "@/hooks/useSaveTrip";

interface SavedTripState {
  from: string;
  to: string;
  days: string;
  budget: string;
  mode: string;
  savedTripId?: string;
  savedItinerary?: DayPlan[];
  savedPreferences?: { interests: string[]; pace: string; mustSees: string };
}

export default function TripWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { saveTrip, isSaving } = useSaveTrip();
  const [highlightedStop, setHighlightedStop] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [focusedDay, setFocusedDay] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [zoomTarget, setZoomTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const state = (location.state || {}) as SavedTripState;
  const tripConfig: TripConfig = { from: state.from || "Unknown", to: state.to || "Unknown", days: state.days || "Weekend", budget: state.budget || "$$", mode: state.mode || "Car" };
  const [savedTripId, setSavedTripId] = useState<string | undefined>(state.savedTripId);
  const [itinerary, setItinerary] = useState<DayPlan[] | null>(state.savedItinerary ?? null);
  const [preferences, setPreferences] = useState<{ interests: string[]; pace: string; mustSees: string } | undefined>(state.savedPreferences);

  const handleStopClick = (name: string, lat: number, lng: number) => {
    setSelectedStop({ name, lat, lng });
  };

  const handleStopZoom = (lat: number, lng: number) => {
    setZoomTarget({ lat, lng });
  };

  const handleItineraryReady = (newItinerary: DayPlan[]) => {
    setItinerary(newItinerary);
  };

  const handleSave = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!itinerary) return;
    const id = await saveTrip(tripConfig, itinerary, preferences, savedTripId);
    if (id) setSavedTripId(id);
  };

  const handlePreferencesUpdate = (prefs: { interests: string[]; pace: string; mustSees: string }) => {
    setPreferences(prefs);
  };

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
          {itinerary && (
            <Button variant="ghost" size="sm" onClick={handleSave} disabled={isSaving} className="font-body text-xs gap-1">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {savedTripId ? "Saved" : "Save"}
            </Button>
          )}
          {itinerary && <ExportTripMenu itinerary={itinerary} tripConfig={tripConfig} />}
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="font-body text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> New Trip
          </Button>
          <UserMenu />
        </div>
      </nav>


      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {!isMobile ? (
          <>
            <div className="w-[45%] min-w-[360px] border-r border-border overflow-hidden">
              <ChatPanel
                tripConfig={tripConfig}
                onHighlightStop={setHighlightedStop}
                highlightedStop={highlightedStop}
                onItineraryReady={handleItineraryReady}
                onDayClick={setFocusedDay}
                onStopClick={handleStopClick}
                onStopZoom={handleStopZoom}
                onSaveTrip={handleSave}
                onPreferencesUpdate={handlePreferencesUpdate}
                initialItinerary={state.savedItinerary}
              />
            </div>
            <div className="flex-1 relative">
              <TripMap itinerary={itinerary} highlightedStop={highlightedStop} onHighlightStop={setHighlightedStop} focusedDay={focusedDay} onResetFocus={() => setFocusedDay(null)} onStopClick={handleStopClick} zoomTarget={zoomTarget} onZoomComplete={() => setZoomTarget(null)} />
              <DestinationPanel stop={selectedStop} onClose={() => setSelectedStop(null)} />
            </div>
          </>
        ) : (
          <>
            <div className={`flex-1 relative ${showMap ? '' : 'hidden'}`}>
              <TripMap itinerary={itinerary} highlightedStop={highlightedStop} onHighlightStop={setHighlightedStop} focusedDay={focusedDay} onResetFocus={() => setFocusedDay(null)} onStopClick={handleStopClick} visible={showMap} zoomTarget={zoomTarget} onZoomComplete={() => setZoomTarget(null)} />
              <DestinationPanel stop={selectedStop} onClose={() => setSelectedStop(null)} />
            </div>
            <div className={`flex-1 overflow-hidden ${showMap ? 'hidden' : ''}`}>
              <ChatPanel
                tripConfig={tripConfig}
                onHighlightStop={setHighlightedStop}
                highlightedStop={highlightedStop}
                onItineraryReady={handleItineraryReady}
                onDayClick={(day) => { setFocusedDay(day); setShowMap(true); }}
                onStopClick={(name, lat, lng) => { handleStopClick(name, lat, lng); setShowMap(true); }}
                onStopZoom={(lat, lng) => { handleStopZoom(lat, lng); setShowMap(true); }}
                onSaveTrip={handleSave}
                onPreferencesUpdate={handlePreferencesUpdate}
                initialItinerary={state.savedItinerary}
              />
            </div>
          </>
        )}
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />

      {/* Mobile sticky bottom map/chat toggle — only after itinerary is ready */}
      {isMobile && itinerary && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-50 pointer-events-none">
          <Button
            onClick={() => setShowMap(!showMap)}
            className="w-full pointer-events-auto shadow-lg rounded-full h-12 text-sm font-body font-semibold gap-2"
          >
            {showMap ? <MessageSquare className="w-4 h-4" /> : <Map className="w-4 h-4" />}
            {showMap ? "Back to Chat" : "View on Map"}
          </Button>
        </div>
      )}
    </div>
  );
}
