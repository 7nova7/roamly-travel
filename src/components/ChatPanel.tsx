import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Plus, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { TypingIndicator } from "@/components/TypingIndicator";
import { INTEREST_OPTIONS, PACE_OPTIONS, type DayPlan, type TripConfig } from "@/data/demoTrip";
import { DayCard } from "./DayCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getMapboxToken } from "@/lib/mapbox";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  content: string;
  type: "text" | "interests" | "pace" | "input" | "loading" | "itinerary" | "actions";
}

interface ChatPanelProps {
  tripConfig: TripConfig;
  onHighlightStop: (stopId: string | null) => void;
  highlightedStop: string | null;
  onItineraryReady: (itinerary: DayPlan[]) => void;
  onDayClick?: (dayNumber: number) => void;
  onStopClick?: (name: string, lat: number, lng: number) => void;
  onStopZoom?: (lat: number, lng: number) => void;
  onSaveTrip?: () => void;
  onPreferencesUpdate?: (prefs: { interests: string[]; pace: string; mustSees: string }) => void;
  initialItinerary?: DayPlan[];
  reserveBottomSpace?: boolean;
}

export function ChatPanel({ tripConfig, onHighlightStop, highlightedStop, onItineraryReady, onDayClick, onStopClick, onStopZoom, onSaveTrip, onPreferencesUpdate, initialItinerary, reserveBottomSpace = false }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [generatedItinerary, setGeneratedItinerary] = useState<DayPlan[] | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedPace, setSelectedPace] = useState("");
  const [mustSeesValue, setMustSeesValue] = useState("");
  const [addDay, setAddDay] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ name: "", time: "", location: "" });
  const [isAddingStop, setIsAddingStop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const addBotMessage = useCallback((content: string, type: ChatMessage["type"] = "text", delay = 800) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { id: `msg-${Date.now()}`, sender: "bot", content, type }]);
    }, delay);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, sender: "user", content, type: "text" }]);
  }, []);

  const updateItinerary = useCallback((updater: (prev: DayPlan[]) => DayPlan[]) => {
    setGeneratedItinerary(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      onItineraryReady(next);
      return next;
    });
  }, [onItineraryReady]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (phase === 0) {
      setPhase(1);

      // If loading a saved trip, skip the conversation flow
      if (initialItinerary) {
        setGeneratedItinerary(initialItinerary);
        onItineraryReady(initialItinerary);
        addBotMessage("Welcome back! Here's your saved itinerary. Want me to adjust anything?", "text", 300);
        setTimeout(() => {
          setMessages(prev => [...prev, { id: "itinerary", sender: "bot", content: "", type: "itinerary" }]);
          setTimeout(() => {
            setMessages(prev => [...prev, { id: `actions-${Date.now()}`, sender: "bot", content: "", type: "actions" }]);
          }, 800);
        }, 1100);
        return;
      }

      const tripDescription = tripConfig.startDate && tripConfig.endDate
        ? `trip from ${format(parseISO(tripConfig.startDate), "MMM d")} to ${format(parseISO(tripConfig.endDate), "MMM d")}`
        : `${tripConfig.days.toLowerCase()} trip`;
      const destination = tripConfig.from === tripConfig.to
        ? `exploring ${tripConfig.to}`
        : `from ${tripConfig.from} to ${tripConfig.to}`;
      addBotMessage(
        `Hey! 👋 I'm planning your ${tripDescription} ${destination}. Before I build your itinerary, I want to make sure it's perfect for you.\n\nWhat kinds of experiences are you most into?`,
        "text",
        500
      );
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "interests", sender: "bot", content: "", type: "interests" }]);
      }, 1400);
    }
  }, [phase, addBotMessage, tripConfig, initialItinerary, onItineraryReady]);

  const handleInterestSelect = (selected: string[]) => {
    setSelectedInterests(selected);
    addUserMessage(selected.join(", "));
    setTimeout(() => {
      addBotMessage("Great taste! Now, how do you like your days?", "text", 600);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "pace", sender: "bot", content: "", type: "pace" }]);
      }, 1500);
    }, 300);
  };

  const handlePaceSelect = (pace: string) => {
    setSelectedPace(pace);
    addUserMessage(pace);
    setTimeout(() => {
      addBotMessage("One more — any must-see spots you already have in mind? Drop them here and I'll build around them.", "text", 600);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "spots-input", sender: "bot", content: "", type: "input" }]);
        setPhase(2);
      }, 1500);
    }, 300);
  };

  const handleSpotsSubmit = async () => {
    const mustSees = inputValue.trim() || "No specific spots — surprise me!";
    setMustSeesValue(mustSees);
    addUserMessage(mustSees);
    setInputValue("");
    onPreferencesUpdate?.({ interests: selectedInterests, pace: selectedPace, mustSees });

    setTimeout(() => {
      addBotMessage("Perfect. Give me a moment to build something great... 🗺️", "text", 400);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "loading", sender: "bot", content: "", type: "loading" }]);
        generateItinerary(mustSees);
      }, 1200);
    }, 300);
  };

  const generateItinerary = async (mustSees: string, adjustmentRequest?: string, currentItinerary?: DayPlan[]) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-itinerary", {
        body: {
          from: tripConfig.from,
          to: tripConfig.to,
          days: tripConfig.days,
          budget: tripConfig.budget,
          mode: tripConfig.mode,
          startDate: tripConfig.startDate,
          endDate: tripConfig.endDate,
          interests: selectedInterests,
          pace: selectedPace,
          mustSees,
          adjustmentRequest,
          currentItinerary: currentItinerary ? JSON.stringify(currentItinerary) : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const itinerary: DayPlan[] = data.itinerary;
      setGeneratedItinerary(itinerary);

      // Remove loading, show itinerary
      setMessages(prev => prev.filter(m => m.id !== "loading" && m.id !== "itinerary" && m.id !== "actions"));
      setMessages(prev => [...prev, { id: "itinerary", sender: "bot", content: "", type: "itinerary" }]);
      onItineraryReady(itinerary);

      setTimeout(() => {
        addBotMessage(
          adjustmentRequest
            ? "Done! I've updated your itinerary. Want me to adjust anything else?"
            : "Here's your optimized plan! I clustered nearby stops together and ordered everything around opening hours. Want me to adjust anything?",
          "text",
          600
        );
        setTimeout(() => {
          setMessages(prev => [...prev, { id: `actions-${Date.now()}`, sender: "bot", content: "", type: "actions" }]);
        }, 1400);
      }, 500);
    } catch (err: any) {
      console.error("Itinerary generation failed:", err);
      setMessages(prev => prev.filter(m => m.id !== "loading"));
      addBotMessage("Sorry, I couldn't generate your itinerary. Please try again.", "text", 400);
      toast({
        title: "Generation failed",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleActionChip = (action: string) => {
    addUserMessage(action);
    setTimeout(() => {
      addBotMessage("On it! Adjusting your itinerary... 🔄", "text", 400);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "loading", sender: "bot", content: "", type: "loading" }]);
        generateItinerary(mustSeesValue || "None", action, generatedItinerary || undefined);
      }, 1200);
    }, 300);
  };

  const handleDeleteStop = useCallback((dayNumber: number, stopId: string) => {
    updateItinerary(prev => prev.map(day => (
      day.day === dayNumber
        ? { ...day, stops: day.stops.filter(stop => stop.id !== stopId) }
        : day
    )));
    toast({
      title: "Activity removed",
      description: `Removed from Day ${dayNumber}.`,
    });
  }, [toast, updateItinerary]);

  const openAddStop = useCallback((dayNumber: number) => {
    setAddDay(dayNumber);
    setAddForm({ name: "", time: "", location: "" });
  }, []);

  const closeAddStop = useCallback(() => {
    setAddDay(null);
  }, []);

  const handleAddStop = useCallback(async () => {
    if (!addDay || !addForm.name.trim()) {
      toast({ title: "Add a name", description: "Please enter an activity name.", variant: "destructive" });
      return;
    }

    const baseQuery = (addForm.location.trim() || addForm.name.trim());
    const query = tripConfig.to && !baseQuery.toLowerCase().includes(tripConfig.to.toLowerCase())
      ? `${baseQuery} ${tripConfig.to}`
      : baseQuery;

    setIsAddingStop(true);

    try {
      const token = await getMapboxToken();
      const resp = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1&types=poi,address,place`
      );
      if (!resp.ok) throw new Error("Map lookup failed");
      const data = await resp.json();
      const feature = data?.features?.[0];
      if (!feature?.center?.length) {
        throw new Error("No matching location found. Try a more specific address.");
      }

      const [lng, lat] = feature.center as [number, number];
      const newStop = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: addForm.time.trim() || "Anytime",
        name: addForm.name.trim(),
        description: "Custom activity added by you.",
        hours: "Hours vary",
        cost: "Cost varies",
        lat,
        lng,
        tags: ["Custom"],
      };

      updateItinerary(prev => prev.map(day => (
        day.day === addDay
          ? { ...day, stops: [...day.stops, newStop] }
          : day
      )));

      setAddDay(null);
      setAddForm({ name: "", time: "", location: "" });
      toast({ title: "Activity added", description: `Added to Day ${addDay}.` });
    } catch (err: any) {
      toast({
        title: "Couldn’t add activity",
        description: err?.message || "Try a more specific place or address.",
        variant: "destructive",
      });
    } finally {
      setIsAddingStop(false);
    }
  }, [addDay, addForm, toast, tripConfig.to, updateItinerary]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-body font-bold">R</div>
        <div>
          <p className="font-body font-semibold text-sm text-foreground">Roamly</p>
          <p className="text-xs text-muted-foreground font-body">AI Trip Planner</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar ${reserveBottomSpace ? "pb-24" : ""}`}
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender === "bot" && msg.type === "text" && (
                <div className="max-w-[85%] bg-secondary rounded-2xl rounded-tl-md px-4 py-3">
                  <p className="text-sm font-body text-foreground whitespace-pre-line">{msg.content}</p>
                </div>
              )}
              {msg.sender === "user" && (
                <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3">
                  <p className="text-sm font-body">{msg.content}</p>
                </div>
              )}
              {msg.type === "interests" && <InterestPicker onSelect={handleInterestSelect} />}
              {msg.type === "pace" && <PacePicker onSelect={handlePaceSelect} />}
              {msg.type === "input" && (
                <div className="w-full max-w-[85%]">
                  <div className="flex gap-2">
                    <input
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSpotsSubmit()}
                      placeholder="e.g., Golden Gate Bridge, Yosemite..."
                      className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button onClick={handleSpotsSubmit} size="icon" className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <button onClick={handleSpotsSubmit} className="text-xs text-muted-foreground font-body mt-2 hover:underline">Skip — surprise me!</button>
                </div>
              )}
              {msg.type === "loading" && <LoadingAnimation />}
              {msg.type === "itinerary" && generatedItinerary && (
                <div className="w-full space-y-4">
                  {generatedItinerary.map(day => (
                    <div key={day.day} className="space-y-2">
                      <DayCard
                        day={day}
                        onHighlightStop={onHighlightStop}
                        highlightedStop={highlightedStop}
                        onDayClick={onDayClick}
                        onStopClick={onStopClick}
                        onStopZoom={onStopZoom}
                        onDeleteStop={handleDeleteStop}
                        onAddStop={openAddStop}
                      />
                      {addDay === day.day && (
                        <AddActivityForm
                          dayNumber={day.day}
                          value={addForm}
                          onChange={setAddForm}
                          onCancel={closeAddStop}
                          onSubmit={handleAddStop}
                          isSubmitting={isAddingStop}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {msg.type === "actions" && <ActionChips onAction={handleActionChip} onSave={onSaveTrip} />}
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl rounded-tl-md">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InterestPicker({ onSelect }: { onSelect: (s: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [options, setOptions] = useState(INTEREST_OPTIONS.map(o => ({ ...o, isCustom: false })));
  const [newActivity, setNewActivity] = useState("");

  const toggle = (label: string) => setSelected(prev => prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]);

  const removeOption = (label: string) => {
    setOptions(prev => prev.filter(o => o.label !== label));
    setSelected(prev => prev.filter(s => s !== label));
  };

  const addCustomActivity = () => {
    const trimmed = newActivity.trim();
    if (!trimmed || trimmed.length > 40) return;
    if (options.some(o => o.label.toLowerCase() === trimmed.toLowerCase())) return;
    const newOpt = { emoji: "✨", label: trimmed, isCustom: true };
    setOptions(prev => [...prev, newOpt]);
    setSelected(prev => [...prev, trimmed]);
    setNewActivity("");
  };

  return (
    <div className="w-full max-w-[85%]">
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map(opt => (
          <div key={opt.label} className="group relative">
            <button
              onClick={() => toggle(opt.label)}
              className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all pr-7 ${
                selected.includes(opt.label)
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); removeOption(opt.label); }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={newActivity}
          onChange={e => setNewActivity(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCustomActivity()}
          placeholder="Add a custom activity..."
          maxLength={40}
          className="flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-body focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={addCustomActivity}
          disabled={!newActivity.trim()}
          className="px-3 py-1.5 rounded-full text-xs font-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      {selected.length > 0 && (
        <Button onClick={() => onSelect(selected)} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-xs rounded-full">
          Continue with {selected.length} selected →
        </Button>
      )}
    </div>
  );
}

function PacePicker({ onSelect }: { onSelect: (s: string) => void }) {
  return (
    <div className="w-full max-w-[85%] flex flex-wrap gap-2">
      {PACE_OPTIONS.map(opt => (
        <button
          key={opt.label}
          onClick={() => onSelect(opt.label)}
          className="px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-all text-sm font-body"
        >
          {opt.emoji} <span className="font-semibold">{opt.label}</span>
          <span className="block text-xs opacity-70">{opt.description}</span>
        </button>
      ))}
    </div>
  );
}

function LoadingAnimation() {
  return (
    <div className="w-full max-w-[85%] bg-secondary rounded-2xl rounded-tl-md p-6 flex flex-col items-center gap-3">
      <svg width="120" height="40" viewBox="0 0 120 40" className="text-accent">
        <path
          d="M10 30 Q30 10 50 25 T90 15 T110 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="1000"
          strokeLinecap="round"
          className="animate-draw-route"
        />
        <circle cx="10" cy="30" r="4" fill="hsl(var(--primary))" />
        <circle cx="110" cy="20" r="4" fill="hsl(var(--accent))" />
      </svg>
      <p className="text-sm font-body text-muted-foreground">Optimizing your route...</p>
    </div>
  );
}

function AddActivityForm({
  dayNumber,
  value,
  onChange,
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  dayNumber: number;
  value: { name: string; time: string; location: string };
  onChange: (next: { name: string; time: string; location: string }) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="w-full bg-card border border-border/60 rounded-2xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-body font-semibold text-foreground">Add activity to Day {dayNumber}</p>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          aria-label="Close add activity"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="grid gap-2">
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Activity name (required)"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          placeholder="Time (optional, e.g., 2:00 PM)"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          value={value.location}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          placeholder="Location or address (for map pin)"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || !value.name.trim()}
          size="sm"
          className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-body gap-2"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Add activity
        </Button>
        <button
          onClick={onCancel}
          className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
      <p className="mt-2 text-[10px] font-body text-muted-foreground">
        Tip: add a specific place or address for best map results.
      </p>
    </div>
  );
}

function ActionChips({ onAction, onSave }: { onAction: (action: string) => void; onSave?: () => void }) {
  const [showInput, setShowInput] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleCustomSubmit = () => {
    if (!customText.trim()) return;
    onAction(customText.trim());
    setCustomText("");
    setShowInput(false);
  };

  return (
    <div className="w-full max-w-[85%] space-y-2">
      <div className="flex flex-wrap gap-2">
        {["Add more stops", "Make it more relaxed", "Swap Day 1 and 2", "Find restaurants near stops"].map(action => (
          <button
            key={action}
            onClick={() => onAction(action)}
            className="px-3 py-1.5 rounded-full text-xs font-body font-medium bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-all border border-border/50"
          >
            {action}
          </button>
        ))}
        {onSave && (
          <button
            onClick={onSave}
            className="px-3 py-1.5 rounded-full text-xs font-body font-medium bg-accent/10 text-accent-foreground hover:bg-accent hover:text-accent-foreground transition-all border border-accent/30"
          >
            💾 Save Trip
          </button>
        )}
        <button
          onClick={() => setShowInput(!showInput)}
          className="px-3 py-1.5 rounded-full text-xs font-body font-medium bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all border border-border border-dashed"
        >
          ✏️ Something else...
        </button>
      </div>
      {showInput && (
        <div className="flex gap-2 mt-1">
          <input
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCustomSubmit()}
            placeholder="Tell me what to change..."
            className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <Button onClick={handleCustomSubmit} size="icon" className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
