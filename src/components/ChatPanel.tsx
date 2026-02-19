import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Plus, Loader2, ArrowRight, Compass, Sparkles, BedDouble, MapPin, Building2, ChevronLeft, ChevronRight, CloudSun, ThermometerSun } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { TypingIndicator } from "@/components/TypingIndicator";
import { INTEREST_OPTIONS, PACE_OPTIONS, type DayPlan, type TripConfig } from "@/data/demoTrip";
import { DayCard } from "./DayCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { loadGoogleMaps } from "@/lib/google-maps";
import { fetchCityInsights, normalizeDestinationLabel, type CityInsightData } from "@/lib/city-intel";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  content: string;
  type: "text" | "interests" | "pace" | "loading" | "itinerary" | "actions" | "stay-intent" | "stay-budget";
}

interface StayOption {
  id: string;
  name: string;
  type: string;
  neighborhood: string;
  address: string;
  nightlyPrice: string;
  style: string;
  why: string;
  bestFor: string;
  lat: number;
  lng: number;
}

interface ActivitySearchResult {
  place_id?: string;
  formatted_address?: string;
  name?: string;
  geometry?: {
    location?: {
      lat: number | (() => number);
      lng: number | (() => number);
    };
  };
}

interface GeoPoint {
  lat: number;
  lng: number;
}

interface GeocodeResult {
  geometry?: {
    location?: {
      lat: number | (() => number);
      lng: number | (() => number);
    };
  };
}

interface GoogleMapsPlacesLike {
  Geocoder?: new () => {
    geocode: (
      request: { address: string },
      callback: (results: GeocodeResult[] | null, status: string) => void,
    ) => void;
  };
  places?: {
    PlacesService: new (container: Element) => {
      textSearch: (
        request: { query: string; location?: GeoPoint; radius?: number },
        callback: (results: ActivitySearchResult[] | null, status: string) => void,
      ) => void;
      getDetails: (
        request: { placeId: string; fields?: string[] },
        callback: (result: ActivitySearchResult | null, status: string) => void,
      ) => void;
    };
    Autocomplete: new (
      input: HTMLInputElement,
      options?: { fields?: string[]; types?: string[] },
    ) => GoogleAutocompleteInstance;
    PlacesServiceStatus: {
      OK: string;
    };
  };
}

interface GoogleAutocompleteInstance {
  addListener: (eventName: "place_changed", handler: () => void) => void;
  getPlace: () => ActivitySearchResult;
  setBounds: (bounds: { north: number; south: number; east: number; west: number }) => void;
  setOptions: (options: { strictBounds?: boolean }) => void;
}

const STAY_BUDGET_VIBES = [
  { label: "Backpack & street snacks", hint: "Smart-value stays close to the action." },
  { label: "Main character moments", hint: "Stylish comfort with great location balance." },
  { label: "Suite life energy", hint: "Premium hotels with memorable views and perks." },
];

const LOADING_STEPS = [
  "Optimizing your route",
  "Scoring nearby spots",
  "Balancing travel time + vibe",
];
const CITY_INTEL_ROTATE_MS = 5200;

const CHAT_CLOSE_PHRASES = [
  "done",
  "all set",
  "thats all",
  "that is all",
  "we are done",
  "were done",
  "looks good",
  "looks great",
  "this is perfect",
  "good for now",
  "nothing else",
  "no more changes",
  "no more edits",
  "stop here",
  "end chat",
  "im good",
  "i am good",
];

const CHAT_ACK_PHRASES = [
  "thanks",
  "thank you",
  "cool",
  "awesome",
  "great",
  "nice",
  "sounds good",
  "ok",
  "okay",
  "got it",
  "perfect",
];

const CHAT_DECLINE_PHRASES = [
  "no",
  "nope",
  "nah",
  "not now",
  "no thanks",
  "pass",
  "skip",
  "maybe later",
];

const CHAT_ACTION_KEYWORDS = [
  "add",
  "remove",
  "swap",
  "change",
  "update",
  "move",
  "replace",
  "find",
  "show",
  "adjust",
  "edit",
  "tweak",
  "reorder",
  "drag",
  "drop",
  "include",
  "exclude",
  "zoom",
  "pin",
  "book",
];

const DEFAULT_DAY_START_MINUTES = 9 * 60 + 30; // 9:30 AM
const DEFAULT_STOP_GAP_MINUTES = 150; // 2.5h
const DAY_COLORS = ["#1B4332", "#2563EB", "#F4A261", "#D6336C", "#6D28D9", "#0D9488", "#EAB308"];

function parseClockTimeToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const [, hoursStr, minutesStr, periodRaw] = match;
  const rawHours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10);
  if (Number.isNaN(rawHours) || Number.isNaN(minutes) || rawHours < 1 || rawHours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  const period = periodRaw.toUpperCase();
  const normalizedHours = rawHours % 12 + (period === "PM" ? 12 : 0);
  return normalizedHours * 60 + minutes;
}

function formatMinutesAsClock(totalMinutes: number): string {
  const dayMinutes = 24 * 60;
  const normalized = ((totalMinutes % dayMinutes) + dayMinutes) % dayMinutes;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function resequenceStopTimes(stops: DayPlan["stops"]): DayPlan["stops"] {
  if (stops.length === 0) return stops;

  const parsedTimes = stops
    .map((stop) => parseClockTimeToMinutes(stop.time))
    .filter((time): time is number => time !== null)
    .sort((a, b) => a - b);

  const start = parsedTimes.length > 0 ? parsedTimes[0] : DEFAULT_DAY_START_MINUTES;

  let gap = DEFAULT_STOP_GAP_MINUTES;
  if (parsedTimes.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < parsedTimes.length; i += 1) {
      const diff = parsedTimes[i] - parsedTimes[i - 1];
      if (diff >= 45 && diff <= 360) diffs.push(diff);
    }
    if (diffs.length > 0) {
      const avg = Math.round(diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length);
      gap = Math.max(90, Math.min(240, avg));
    }
  }

  return stops.map((stop, index) => ({
    ...stop,
    time: formatMinutesAsClock(start + index * gap),
  }));
}

function resequenceDayPlans(days: DayPlan[]): DayPlan[] {
  return days.map((day, idx) => ({
    ...day,
    day: idx + 1,
    color: DAY_COLORS[idx % DAY_COLORS.length],
  }));
}

function normalizeIntentText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasActionIntent(value: string): boolean {
  return CHAT_ACTION_KEYWORDS.some((keyword) => value.includes(keyword));
}

function containsPhrase(value: string, phrases: string[]): boolean {
  return phrases.some((phrase) =>
    value === phrase ||
    value.startsWith(`${phrase} `) ||
    value.endsWith(` ${phrase}`) ||
    value.includes(` ${phrase} `)
  );
}

function isSimpleDecline(value: string): boolean {
  const words = value.split(" ").filter(Boolean);
  return words.length <= 3 && CHAT_DECLINE_PHRASES.includes(value);
}

function botPromptExpectsYesNo(content: string): boolean {
  const prompt = normalizeIntentText(content);
  return (
    prompt.includes("want to add another") ||
    prompt.includes("adjust the itinerary") ||
    prompt.includes("want me to") ||
    prompt.includes("want me") ||
    prompt.includes("want to")
  );
}

interface ChatPanelProps {
  tripConfig: TripConfig;
  onHighlightStop: (stopId: string | null) => void;
  highlightedStop: string | null;
  onItineraryReady: (itinerary: DayPlan[]) => void;
  onDayClick?: (dayNumber: number) => void;
  focusedDay?: number | null;
  onResetDayFocus?: () => void;
  onStopClick?: (name: string, lat: number, lng: number) => void;
  onStopZoom?: (lat: number, lng: number) => void;
  onPreviewPin?: (name: string, lat: number, lng: number) => void;
  onSaveTrip?: () => void;
  onPreferencesUpdate?: (prefs: { interests: string[]; pace: string; mustSees: string }) => void;
  initialItinerary?: DayPlan[];
  reserveBottomSpace?: boolean;
}

export function ChatPanel({ tripConfig, onHighlightStop, highlightedStop, onItineraryReady, onDayClick, focusedDay = null, onResetDayFocus, onStopClick, onStopZoom, onPreviewPin, onSaveTrip, onPreferencesUpdate, initialItinerary, reserveBottomSpace = false }: ChatPanelProps) {
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState(0);
  const [chatInitiated, setChatInitiated] = useState(Boolean(initialItinerary));
  const [isTyping, setIsTyping] = useState(false);
  const [generatedItinerary, setGeneratedItinerary] = useState<DayPlan[] | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedPace, setSelectedPace] = useState("");
  const [mustSeesValue, setMustSeesValue] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [stayOptions, setStayOptions] = useState<StayOption[]>([]);
  const [selectedStays, setSelectedStays] = useState<StayOption[]>([]);
  const [stayBudgetVibe, setStayBudgetVibe] = useState("");
  const [planTab, setPlanTab] = useState<"itinerary" | "stays">("itinerary");
  const [isFindingStays, setIsFindingStays] = useState(false);
  const [hasPromptedStays, setHasPromptedStays] = useState(false);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ name: "", time: "", placeId: null as string | null });
  const [isAddingStop, setIsAddingStop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const planSectionRef = useRef<HTMLDivElement>(null);
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

  const scrollToPlanSection = useCallback(() => {
    const container = scrollRef.current;
    const target = planSectionRef.current;
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 8;
    container.scrollTo({ top: Math.max(nextTop, 0), behavior: "smooth" });
  }, []);

  const addBotMessageImmediate = useCallback((content: string, type: ChatMessage["type"] = "text") => {
    setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sender: "bot", content, type }]);
  }, []);

  const updateItinerary = useCallback((updater: (prev: DayPlan[]) => DayPlan[]) => {
    setGeneratedItinerary(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      onItineraryReady(next);
      return next;
    });
  }, [onItineraryReady]);

  const getErrorMessage = useCallback((err: unknown, fallback: string) => (
    err instanceof Error ? err.message : fallback
  ), []);

  const normalizeStayOption = useCallback((raw: unknown): StayOption | null => {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;
    const lat = Number(value.lat);
    const lng = Number(value.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const idBase = typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : typeof value.name === "string" && value.name.trim()
        ? value.name.trim().toLowerCase().replace(/\s+/g, "-")
        : `stay-${Date.now()}`;

    return {
      id: idBase,
      name: typeof value.name === "string" ? value.name : "Unnamed stay",
      type: typeof value.type === "string" ? value.type : "Hotel",
      neighborhood: typeof value.neighborhood === "string" ? value.neighborhood : "Central",
      address: typeof value.address === "string" ? value.address : "",
      nightlyPrice: typeof value.nightlyPrice === "string" ? value.nightlyPrice : "Price varies",
      style: typeof value.style === "string" ? value.style : "Recommended",
      why: typeof value.why === "string" ? value.why : "Good match for your trip.",
      bestFor: typeof value.bestFor === "string" ? value.bestFor : "General travelers",
      lat,
      lng,
    };
  }, []);

  const startConversation = useCallback(() => {
    if (chatInitiated) return;
    setChatInitiated(true);
  }, [chatInitiated]);

  const openStayBudgetPrompt = useCallback(() => {
    addBotMessage("Love that. Pick your stay vibe and I’ll curate accommodations that fit your trip.", "text", 350);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: `stay-budget-${Date.now()}`, sender: "bot", content: "", type: "stay-budget" }]);
    }, 1100);
  }, [addBotMessage]);

  const promptStayDiscovery = useCallback(() => {
    if (hasPromptedStays) return;
    setHasPromptedStays(true);
    setTimeout(() => {
      addBotMessage("Want me to scout great accommodations near your itinerary too?", "text", 500);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: `stay-intent-${Date.now()}`, sender: "bot", content: "", type: "stay-intent" }]);
      }, 1200);
    }, 450);
  }, [addBotMessage, hasPromptedStays]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (initialItinerary && !chatInitiated) {
      setChatInitiated(true);
    }
  }, [initialItinerary, chatInitiated]);

  useEffect(() => {
    if (!chatInitiated || phase !== 0) {
      return;
    }

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
          setTimeout(() => {
            promptStayDiscovery();
          }, 900);
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
  }, [chatInitiated, phase, addBotMessage, tripConfig, initialItinerary, onItineraryReady, promptStayDiscovery]);

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
    const mustSees = "No specific spots — surprise me!";
    setMustSeesValue(mustSees);
    setStayOptions([]);
    setSelectedStays([]);
    setStayBudgetVibe("");
    setPlanTab("itinerary");
    setHasPromptedStays(false);
    onPreferencesUpdate?.({ interests: selectedInterests, pace, mustSees });
    setTimeout(() => {
      setPhase(2);
      addBotMessageImmediate("Perfect. Give me a moment to build something great... 🗺️");
      setMessages(prev => [...prev, { id: `loading-${Date.now()}`, sender: "bot", content: "", type: "loading" }]);
      void generateItinerary(mustSees);
    }, 300);
  };

  const fetchStayRecommendations = useCallback(async (budgetVibe: string) => {
    if (!generatedItinerary?.length) {
      toast({
        title: "Generate itinerary first",
        description: "I need your itinerary before I can match accommodations.",
        variant: "destructive",
      });
      return;
    }

    setStayBudgetVibe(budgetVibe);
    setIsFindingStays(true);
    setMessages(prev => prev.filter(m => m.type !== "loading"));
    setMessages(prev => [...prev, { id: `stay-loading-${Date.now()}`, sender: "bot", content: "", type: "loading" }]);

    try {
      const { data, error } = await supabase.functions.invoke("recommend-stays", {
        body: {
          from: tripConfig.from,
          to: tripConfig.to,
          days: tripConfig.days,
          startDate: tripConfig.startDate,
          endDate: tripConfig.endDate,
          budgetVibe,
          tripBudget: tripConfig.budget,
          itinerary: generatedItinerary,
          preferences: {
            interests: selectedInterests,
            pace: selectedPace,
            mustSees: mustSeesValue || "No specific must-sees",
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parsed = Array.isArray(data?.stays)
        ? data.stays
          .map((item: unknown) => normalizeStayOption(item))
          .filter((item): item is StayOption => Boolean(item))
        : [];
      if (!parsed.length) {
        throw new Error("No stays were returned. Try a different vibe.");
      }

      setStayOptions(parsed);
      setPlanTab("stays");
      setMessages(prev => prev.filter(m => m.type !== "loading"));
      addBotMessage(`Found ${parsed.length} accommodations matched to your trip. Open the Stays tab above your itinerary.`, "text", 320);
      window.setTimeout(() => {
        scrollToPlanSection();
      }, 450);
      window.setTimeout(() => {
        scrollToPlanSection();
      }, 900);
    } catch (err: unknown) {
      console.error("Stay recommendations failed:", err);
      setMessages(prev => prev.filter(m => m.type !== "loading"));
      toast({
        title: "Couldn't fetch stays",
        description: getErrorMessage(err, "Please try again in a moment."),
        variant: "destructive",
      });
      addBotMessage("I hit a snag finding accommodations. Want me to try again?", "text", 320);
    } finally {
      setIsFindingStays(false);
    }
  }, [
    addBotMessage,
    generatedItinerary,
    getErrorMessage,
    mustSeesValue,
    normalizeStayOption,
    scrollToPlanSection,
    selectedInterests,
    selectedPace,
    toast,
    tripConfig.budget,
    tripConfig.days,
    tripConfig.endDate,
    tripConfig.from,
    tripConfig.startDate,
    tripConfig.to,
  ]);

  const handleStayIntentChoice = useCallback((wantsStays: boolean) => {
    if (wantsStays) {
      addUserMessage("Yes, show me accommodation picks");
      openStayBudgetPrompt();
      return;
    }

    addUserMessage("Not now");
    addBotMessage("No problem. Whenever you want, ask me to find accommodations.", "text", 350);
  }, [addBotMessage, addUserMessage, openStayBudgetPrompt]);

  const handleStayBudgetSelect = useCallback((vibe: string) => {
    addUserMessage(vibe);
    setTimeout(() => {
      addBotMessage("Great pick. I’m finding places to stay near your route...", "text", 300);
      setTimeout(() => {
        fetchStayRecommendations(vibe);
      }, 750);
    }, 250);
  }, [addBotMessage, addUserMessage, fetchStayRecommendations]);

  const handleAddStayToColumn = useCallback((stay: StayOption) => {
    setSelectedStays((prev) => {
      if (prev.some((item) => item.id === stay.id)) return prev;
      return [...prev, stay];
    });

    addUserMessage(`Add ${stay.name} to my stays`);
    addBotMessage(`${stay.name} is now saved in your Stays column. Want to add another or adjust the itinerary?`, "text", 260);
    onPreviewPin?.(stay.name, stay.lat, stay.lng);
    onStopZoom?.(stay.lat, stay.lng);
    toast({
      title: "Stay saved",
      description: `${stay.name} was added to your Stays column.`,
    });
  }, [addBotMessage, addUserMessage, onPreviewPin, onStopZoom, toast]);

  const handleRemoveStayFromColumn = useCallback((stayId: string) => {
    setSelectedStays((prev) => prev.filter((item) => item.id !== stayId));
  }, []);

  const generateItinerary = async (mustSees: string, adjustmentRequest?: string, currentItinerary?: DayPlan[]) => {
    const start = performance.now();
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
      console.info(`[generate-itinerary] completed in ${Math.round(performance.now() - start)}ms`);

      // Remove loading, show itinerary
      setMessages(prev => prev.filter(m => m.type !== "loading" && m.id !== "itinerary" && m.id !== "actions"));
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
          if (!adjustmentRequest) {
            setTimeout(() => {
              promptStayDiscovery();
            }, 900);
          }
        }, 1400);
      }, 500);
    } catch (err: unknown) {
      console.error("Itinerary generation failed:", err);
      setMessages(prev => prev.filter(m => m.type !== "loading"));
      addBotMessage("Sorry, I couldn't generate your itinerary. Please try again.", "text", 400);
      toast({
        title: "Generation failed",
        description: getErrorMessage(err, "Something went wrong. Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleActionChip = (action: string) => {
    addUserMessage(action);
    addBotMessageImmediate("On it! Adjusting your itinerary... 🔄");
    setMessages(prev => [...prev, { id: `loading-${Date.now()}`, sender: "bot", content: "", type: "loading" }]);
    void generateItinerary(mustSeesValue || "None", action, generatedItinerary || undefined);
  };

  const handleComposerSubmit = () => {
    const request = composerValue.trim();
    if (!request || !generatedItinerary) return;

    setComposerValue("");
    addUserMessage(request);

    const lower = request.toLowerCase();
    const normalized = normalizeIntentText(request);
    const lastBotText = [...messages]
      .reverse()
      .find((msg) => msg.sender === "bot" && msg.type === "text")?.content || "";
    const hasAction = hasActionIntent(normalized);
    const hasQuestion = request.includes("?");
    const asksForStays = lower.includes("stay") || lower.includes("hotel") || lower.includes("accommodation");
    const directClose = containsPhrase(normalized, CHAT_CLOSE_PHRASES);
    const contextualDecline = isSimpleDecline(normalized) && botPromptExpectsYesNo(lastBotText);
    const wantsToClose = !hasQuestion && !hasAction && !asksForStays && (directClose || contextualDecline);
    const passiveAck = !hasQuestion && !hasAction && !asksForStays && containsPhrase(normalized, CHAT_ACK_PHRASES);

    if (wantsToClose) {
      addBotMessage("Perfect — we’re all set. I’ll pause here and keep this itinerary as-is. If you want edits later, just ask.", "text", 180);
      return;
    }

    if (passiveAck) {
      addBotMessage("Got it. If you want changes, tell me exactly what to tweak and I’ll handle it.", "text", 180);
      return;
    }

    if (asksForStays) {
      if (stayOptions.length > 0) {
        setPlanTab("stays");
        addBotMessage("Already on it — I switched you to the Stays tab so you can pick one to add.", "text", 250);
        window.setTimeout(() => {
          scrollToPlanSection();
        }, 300);
      } else {
        openStayBudgetPrompt();
      }
      return;
    }

    addBotMessageImmediate("On it! Adjusting your itinerary... 🔄");
    setMessages(prev => [...prev, { id: `loading-${Date.now()}`, sender: "bot", content: "", type: "loading" }]);
    void generateItinerary(mustSeesValue || "None", request, generatedItinerary);
  };

  const handleDeleteStop = useCallback((dayNumber: number, stopId: string) => {
    let removedStop: DayPlan["stops"][number] | null = null;
    let removedIndex = -1;
    let changed = false;

    updateItinerary((prev) => prev.map((day) => {
      if (day.day !== dayNumber) return day;

      const idx = day.stops.findIndex((stop) => stop.id === stopId);
      if (idx < 0) return day;

      removedStop = day.stops[idx];
      removedIndex = idx;
      changed = true;

      return {
        ...day,
        stops: day.stops.filter((stop) => stop.id !== stopId),
      };
    }));

    if (!changed || !removedStop) return;

    const deletedStop = removedStop;
    const restoreIndex = removedIndex;
    let undone = false;

    toast({
      title: "Activity removed",
      description: `Removed from Day ${dayNumber}.`,
      duration: 5000,
      action: (
        <ToastAction
          altText="Undo remove activity"
          onClick={() => {
            if (undone) return;
            undone = true;
            updateItinerary((prev) => prev.map((day) => {
              if (day.day !== dayNumber) return day;
              if (day.stops.some((stop) => stop.id === deletedStop.id)) return day;

              const nextStops = [...day.stops];
              const safeIndex = Math.max(0, Math.min(restoreIndex, nextStops.length));
              nextStops.splice(safeIndex, 0, deletedStop);

              return {
                ...day,
                stops: resequenceStopTimes(nextStops),
              };
            }));
            toast({
              title: "Activity restored",
              description: `Added back to Day ${dayNumber}.`,
              duration: 2500,
            });
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  }, [toast, updateItinerary]);

  const handleAddDay = useCallback(() => {
    updateItinerary((prev) => {
      const nextDayNumber = prev.length + 1;
      const next = [
        ...prev,
        {
          day: nextDayNumber,
          title: `Custom Day ${nextDayNumber}`,
          subtitle: "Build this day your way.",
          totalDriving: "0m",
          stops: [],
          estimatedCost: "$0",
          color: DAY_COLORS[(nextDayNumber - 1) % DAY_COLORS.length],
        },
      ];
      return resequenceDayPlans(next);
    });
    setAddDay(null);
    onResetDayFocus?.();
    toast({
      title: "Day added",
      description: "A new day was added to your itinerary.",
    });
  }, [onResetDayFocus, toast, updateItinerary]);

  const handleDeleteDay = useCallback((dayNumber: number) => {
    let removed = false;
    let blocked = false;
    let removedDay: DayPlan | null = null;
    let removedIndex = -1;

    updateItinerary((prev) => {
      if (prev.length <= 1) {
        blocked = true;
        return prev;
      }

      removedIndex = prev.findIndex((day) => day.day === dayNumber);
      if (removedIndex < 0) return prev;

      removedDay = prev[removedIndex];
      const filtered = prev.filter((day) => day.day !== dayNumber);
      removed = true;
      return resequenceDayPlans(filtered);
    });

    if (blocked) {
      toast({
        title: "Can't delete day",
        description: "Your itinerary needs at least one day.",
        variant: "destructive",
      });
      return;
    }

    if (!removed) return;

    const deletedDay = removedDay;
    const deletedDayIndex = removedIndex;
    if (!deletedDay || deletedDayIndex < 0) return;

    setAddDay((current) => {
      if (current === null) return null;
      if (current === dayNumber) return null;
      if (current > dayNumber) return current - 1;
      return current;
    });
    onResetDayFocus?.();
    let undone = false;
    toast({
      title: "Day removed",
      description: `Day ${dayNumber} was removed.`,
      duration: 5000,
      action: (
        <ToastAction
          altText="Undo remove day"
          onClick={() => {
            if (undone) return;
            undone = true;
            updateItinerary((prev) => {
              const next = [...prev];
              const safeIndex = Math.max(0, Math.min(deletedDayIndex, next.length));
              next.splice(safeIndex, 0, deletedDay);
              return resequenceDayPlans(next);
            });
            onResetDayFocus?.();
            toast({
              title: "Day restored",
              description: "Your day was added back.",
              duration: 2500,
            });
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  }, [onResetDayFocus, toast, updateItinerary]);

  const handleMoveStop = useCallback((move: { sourceDay: number; stopId: string; targetDay: number; targetStopId?: string }) => {
    const { sourceDay, stopId, targetDay, targetStopId } = move;
    if (sourceDay === targetDay && targetStopId === stopId) return;

    let movedStopName = "Activity";
    let changed = false;

    updateItinerary((prev) => {
      const next = prev.map((day) => ({ ...day, stops: [...day.stops] }));
      const source = next.find((day) => day.day === sourceDay);
      const target = next.find((day) => day.day === targetDay);
      if (!source || !target) return prev;

      const sourceIndex = source.stops.findIndex((stop) => stop.id === stopId);
      if (sourceIndex === -1) return prev;

      const [movedStop] = source.stops.splice(sourceIndex, 1);
      if (!movedStop) return prev;
      movedStopName = movedStop.name;

      let insertIndex = target.stops.length;
      if (targetStopId) {
        const found = target.stops.findIndex((stop) => stop.id === targetStopId);
        insertIndex = found >= 0 ? found : target.stops.length;
      }
      if (sourceDay === targetDay && targetStopId && sourceIndex < insertIndex) {
        insertIndex -= 1;
      }

      const safeIndex = Math.max(0, Math.min(insertIndex, target.stops.length));
      target.stops.splice(safeIndex, 0, movedStop);
      source.stops = resequenceStopTimes(source.stops);
      if (sourceDay !== targetDay) {
        target.stops = resequenceStopTimes(target.stops);
      }
      changed = true;
      return next;
    });

    if (!changed) return;
    toast({
      title: "Activity moved",
      description: `${movedStopName} moved. Timing was updated to match the new order.`,
    });
  }, [toast, updateItinerary]);

  const handleReorderStops = useCallback((dayNumber: number, orderedStopIds: string[]) => {
    if (!orderedStopIds.length) return;

    updateItinerary((prev) => prev.map((day) => {
      if (day.day !== dayNumber) return day;

      const stopLookup = new Map(day.stops.map((stop) => [stop.id, stop]));
      const reordered = orderedStopIds
        .map((stopId) => stopLookup.get(stopId))
        .filter((stop): stop is DayPlan["stops"][number] => Boolean(stop));

      if (reordered.length === 0) return day;

      const seen = new Set(reordered.map((stop) => stop.id));
      day.stops.forEach((stop) => {
        if (!seen.has(stop.id)) reordered.push(stop);
      });

      const isSameOrder = reordered.length === day.stops.length && reordered.every((stop, idx) => stop.id === day.stops[idx]?.id);
      if (isSameOrder) return day;

      return {
        ...day,
        stops: resequenceStopTimes(reordered),
      };
    }));
  }, [updateItinerary]);

  const openAddStop = useCallback((dayNumber: number) => {
    setAddDay(dayNumber);
    setAddForm({ name: "", time: "", placeId: null });
  }, []);

  const closeAddStop = useCallback(() => {
    setAddDay(null);
  }, []);

  const handleAddStop = useCallback(async () => {
    if (!addDay || !addForm.name.trim()) {
      toast({ title: "Add a name", description: "Please enter an activity name.", variant: "destructive" });
      return;
    }

    const baseQuery = addForm.name.trim();
    const query = tripConfig.to && !baseQuery.toLowerCase().includes(tripConfig.to.toLowerCase())
      ? `${baseQuery} ${tripConfig.to}`
      : baseQuery;

    setIsAddingStop(true);

    try {
      await loadGoogleMaps();
      const gm = (window as Window & { google?: { maps?: GoogleMapsPlacesLike } }).google?.maps;
      if (!gm?.places) {
        throw new Error("Google Places is unavailable right now.");
      }

      const service = new gm.places.PlacesService(document.createElement("div"));
      const getDestinationBias = () => new Promise<GeoPoint | null>((resolve) => {
        if (!tripConfig.to?.trim() || !gm.Geocoder) {
          resolve(null);
          return;
        }

        const geocoder = new gm.Geocoder();
        geocoder.geocode({ address: tripConfig.to }, (results, status) => {
          const location = results?.[0]?.geometry?.location;
          if (status !== "OK" || !location) {
            resolve(null);
            return;
          }

          const lat = typeof location.lat === "function" ? location.lat() : location.lat;
          const lng = typeof location.lng === "function" ? location.lng() : location.lng;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            resolve(null);
            return;
          }
          resolve({ lat, lng });
        });
      });

      const getPlaceById = (placeId: string) =>
        new Promise<ActivitySearchResult | null>((resolve) => {
          service.getDetails(
            { placeId, fields: ["name", "formatted_address", "geometry"] },
            (result: ActivitySearchResult | null, status: string) => {
              if (status === gm.places.PlacesServiceStatus.OK && result?.geometry?.location) {
                resolve(result);
                return;
              }
              resolve(null);
            },
          );
        });

      const getTopTextSearchMatch = () => new Promise<ActivitySearchResult>((resolve, reject) => {
        const destinationBiasPromise = getDestinationBias();
        destinationBiasPromise.then((destinationBias) => {
          const request = destinationBias
            ? { query, location: destinationBias, radius: 30000 }
            : { query };

          service.textSearch(
            request,
            (results: ActivitySearchResult[] | null, status: string) => {
              if (status !== gm.places.PlacesServiceStatus.OK || !results?.length) {
                reject(new Error("No matching location found. Try a more specific activity keyword."));
                return;
              }
              resolve(results[0]);
            },
          );
        }).catch(() => {
          service.textSearch(
            { query },
            (results: ActivitySearchResult[] | null, status: string) => {
              if (status !== gm.places.PlacesServiceStatus.OK || !results?.length) {
                reject(new Error("No matching location found. Try a more specific activity keyword."));
                return;
              }
              resolve(results[0]);
            },
          );
        });
      });

      const topMatch = addForm.placeId
        ? (await getPlaceById(addForm.placeId)) || (await getTopTextSearchMatch())
        : await getTopTextSearchMatch();

      const location = topMatch?.geometry?.location;
      if (!location) {
        throw new Error("No map coordinates found for that activity.");
      }
      const lat = typeof location.lat === "function" ? location.lat() : location.lat;
      const lng = typeof location.lng === "function" ? location.lng() : location.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("No valid coordinates found for that activity.");
      }

      const newStop = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: addForm.time.trim() || "Anytime",
        name: typeof topMatch?.name === "string" && topMatch.name.trim() ? topMatch.name.trim() : addForm.name.trim(),
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
      setAddForm({ name: "", time: "", placeId: null });
      toast({ title: "Activity added", description: `Added to Day ${addDay}.` });
    } catch (err: unknown) {
      toast({
        title: "Couldn’t add activity",
        description: getErrorMessage(err, "Try a more specific activity keyword."),
        variant: "destructive",
      });
    } finally {
      setIsAddingStop(false);
    }
  }, [addDay, addForm, getErrorMessage, toast, tripConfig.to, updateItinerary]);

  return (
    <div className="flex flex-col h-full bg-[radial-gradient(95%_80%_at_0%_0%,hsl(var(--accent)/0.10),transparent_45%),radial-gradient(90%_80%_at_100%_0%,hsl(var(--primary)/0.10),transparent_40%),hsl(var(--background))]">
      <div className="px-4 py-3 border-b border-border/70 bg-card/75 backdrop-blur-md flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-body font-bold shadow-sm">R</div>
        <div>
          <p className="font-body font-semibold text-sm text-foreground">Roamly</p>
          <p className="text-xs text-muted-foreground font-body">AI Trip Planner</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar ${reserveBottomSpace ? "pb-24" : ""}`}
      >
        {!chatInitiated ? (
          <ChatStartHook
            destination={tripConfig.to}
            isRoundTrip={tripConfig.from === tripConfig.to}
            onStart={startConversation}
          />
        ) : (
          <>
            {isMobile && !generatedItinerary && (
              <MobileCityIntelCard
                destination={tripConfig.to}
                startDate={tripConfig.startDate}
                endDate={tripConfig.endDate}
              />
            )}
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
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md px-4 py-3 border border-border/60 bg-card/75 backdrop-blur-sm shadow-sm">
                      <p className="text-sm font-body text-foreground whitespace-pre-line">{msg.content}</p>
                    </div>
                  )}
                  {msg.sender === "user" && (
                    <div className="max-w-[85%] bg-primary/95 text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
                      <p className="text-sm font-body">{msg.content}</p>
                    </div>
                  )}
                  {msg.type === "interests" && <InterestPicker onSelect={handleInterestSelect} />}
                  {msg.type === "pace" && <PacePicker onSelect={handlePaceSelect} />}
                  {msg.type === "loading" && <LoadingAnimation />}
                  {msg.type === "itinerary" && generatedItinerary && (
                    <div ref={planSectionRef} className="w-full space-y-3">
                      <div className="inline-flex rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-1 shadow-sm">
                        <button
                          onClick={() => setPlanTab("itinerary")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-body font-semibold transition-colors ${
                            planTab === "itinerary"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Itinerary
                        </button>
                        <button
                          onClick={() => setPlanTab("stays")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-body font-semibold transition-colors ${
                            planTab === "stays"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Stays {stayOptions.length > 0 ? `(${stayOptions.length})` : ""}
                        </button>
                      </div>

                      {planTab === "itinerary" ? (
                        <div className="space-y-4">
                          {focusedDay !== null && (
                            <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm px-3 py-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-body text-foreground">
                                Map filter: <span className="font-semibold">Day {focusedDay}</span>
                              </p>
                              <button
                                onClick={onResetDayFocus}
                                className="text-xs font-body font-semibold text-accent hover:underline"
                              >
                                Show all pins
                              </button>
                            </div>
                          )}
                          {generatedItinerary.map(day => (
                            <div key={day.day} className="space-y-2">
                              <DayCard
                                day={day}
                                destination={tripConfig.to}
                                onHighlightStop={onHighlightStop}
                                highlightedStop={highlightedStop}
                                onDayClick={onDayClick}
                                isMapFocused={focusedDay === day.day}
                                onStopClick={onStopClick}
                                onStopZoom={onStopZoom}
                                onDeleteStop={handleDeleteStop}
                                onDeleteDay={handleDeleteDay}
                                canDeleteDay={generatedItinerary.length > 1}
                                onAddStop={openAddStop}
                                onMoveStop={handleMoveStop}
                                onReorderStops={handleReorderStops}
                              />
                              {addDay === day.day && (
                                <AddActivityForm
                                  dayNumber={day.day}
                                  destination={tripConfig.to}
                                  value={addForm}
                                  onChange={setAddForm}
                                  onCancel={closeAddStop}
                                  onSubmit={handleAddStop}
                                  isSubmitting={isAddingStop}
                                />
                              )}
                            </div>
                          ))}
                          <button
                            onClick={handleAddDay}
                            className="w-full flex items-center justify-center gap-2 text-xs font-body font-semibold px-3 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add day
                          </button>
                        </div>
                      ) : (
                        <StayRecommendationsPanel
                          options={stayOptions}
                          selectedOptions={selectedStays}
                          budgetVibe={stayBudgetVibe}
                          isLoading={isFindingStays}
                          onRetry={() => openStayBudgetPrompt()}
                          onAddToItinerary={handleAddStayToColumn}
                          onRemoveFromItinerary={handleRemoveStayFromColumn}
                          onViewOnMap={(stay) => {
                            onPreviewPin?.(stay.name, stay.lat, stay.lng);
                            onStopZoom?.(stay.lat, stay.lng);
                          }}
                        />
                      )}
                    </div>
                  )}
                  {msg.type === "stay-intent" && <StayIntentPicker onSelect={handleStayIntentChoice} />}
                  {msg.type === "stay-budget" && <StayBudgetPicker onSelect={handleStayBudgetSelect} />}
                  {msg.type === "actions" && <ActionChips onAction={handleActionChip} onSave={onSaveTrip} />}
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-md border border-border/60 bg-card/75 backdrop-blur-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {chatInitiated && generatedItinerary && (
        <div className="shrink-0 border-t border-border/70 bg-card/75 backdrop-blur-md px-3 py-3">
          <div className="flex gap-2">
            <input
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleComposerSubmit()}
              placeholder="Ask Roamly to tweak your plan, add activities, or find more stays..."
              className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              onClick={handleComposerSubmit}
              size="icon"
              disabled={!composerValue.trim()}
              className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileCityIntelCard({
  destination,
  startDate,
  endDate,
}: {
  destination?: string;
  startDate?: string;
  endDate?: string;
}) {
  const [insights, setInsights] = useState<CityInsightData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const city = normalizeDestinationLabel(destination);
    if (!city) {
      setInsights(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void fetchCityInsights(city, startDate, endDate)
      .then((next) => {
        if (!cancelled) setInsights(next);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination, endDate, startDate]);

  useEffect(() => {
    setSlideIndex(0);
  }, [destination, endDate, startDate, insights?.cityLabel]);

  const slides = useMemo(() => {
    const city = insights?.cityLabel || normalizeDestinationLabel(destination) || "your destination";
    const facts = insights?.facts?.length
      ? insights.facts
      : [`Collecting local highlights for ${city}...`];
    const factSlides = facts.map((fact, idx) => ({
      id: `fact-${idx}`,
      kind: "fact" as const,
      kicker: "Fun fact",
      title: `About ${city}`,
      body: fact,
      glyph: "✨",
    }));

    return [
      {
        id: "weather",
        kind: "weather" as const,
        kicker: insights?.rangeLabel ? `Weather • ${insights.rangeLabel}` : "Weather",
        title: insights?.weatherHeadline || "Weather snapshot loading",
        body: insights?.weatherDetail || `Checking weather for ${city}...`,
        glyph: insights?.weatherGlyph || "🌤️",
      },
      ...factSlides,
    ];
  }, [destination, insights]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, CITY_INTEL_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  const activeSlide = slides[Math.max(0, Math.min(slideIndex, slides.length - 1))];
  const hasMultipleSlides = slides.length > 1;
  const bodyCopy = activeSlide.body.length > 118
    ? `${activeSlide.body.slice(0, 115).trimEnd()}...`
    : activeSlide.body;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-1 mb-1 rounded-2xl border border-white/35 bg-card/78 backdrop-blur-xl shadow-[0_10px_26px_hsl(var(--foreground)/0.14)] overflow-hidden"
    >
      <div className="relative p-3">
        <motion.div
          aria-hidden
          className="absolute -inset-10 bg-[radial-gradient(circle_at_16%_22%,hsl(var(--accent)/0.22),transparent_48%),radial-gradient(circle_at_80%_26%,hsl(var(--primary)/0.20),transparent_52%)]"
          animate={{ rotate: [0, 6, 0], scale: [1, 1.02, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/80 px-2 py-1">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-body font-semibold text-foreground/90">
                City Intel
              </span>
            </div>
            <span className="text-[10px] font-body text-muted-foreground">
              {isLoading ? "Updating..." : "Live preview"}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="rounded-xl border border-border/45 bg-background/70 p-3"
            >
              <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground mb-1">
                {activeSlide.kicker}
              </p>
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center shrink-0">
                  {activeSlide.kind === "weather" ? (
                    <CloudSun className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <ThermometerSun className="w-3.5 h-3.5 text-accent" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground flex items-center gap-1">
                    <span>{activeSlide.glyph}</span>
                    <span>{activeSlide.title}</span>
                  </p>
                  <p className="mt-1 text-xs font-body text-muted-foreground leading-snug">
                    {bodyCopy}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setSlideIndex(idx)}
                  aria-label={`Show insight ${idx + 1}`}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                >
                  <motion.span
                    className="block h-1.5 rounded-full bg-primary/30"
                    animate={{ width: slideIndex === idx ? 20 : 7, opacity: slideIndex === idx ? 1 : 0.45 }}
                    transition={{ duration: 0.2 }}
                  />
                </button>
              ))}
            </div>
            {hasMultipleSlides && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length)}
                  aria-label="Previous insight"
                  className="w-7 h-7 rounded-full border border-border/60 bg-background/75 hover:bg-background transition-colors flex items-center justify-center text-foreground"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-body text-muted-foreground min-w-[30px] text-center">
                  {slideIndex + 1}/{slides.length}
                </span>
                <button
                  onClick={() => setSlideIndex((prev) => (prev + 1) % slides.length)}
                  aria-label="Next insight"
                  className="w-7 h-7 rounded-full border border-border/60 bg-background/75 hover:bg-background transition-colors flex items-center justify-center text-foreground"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChatStartHook({
  destination,
  isRoundTrip,
  onStart,
}: {
  destination: string;
  isRoundTrip: boolean;
  onStart: () => void;
}) {
  const previewPrompts = isRoundTrip
    ? [
      "Find hidden gems locals actually go to",
      "Balance iconic spots with calmer neighborhoods",
      "Build food + culture without long lines",
    ]
    : [
      "Plan smart routes with less backtracking",
      "Mix landmarks, food, and one wow moment",
      "Keep it flexible but still structured",
    ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto mt-10 w-full max-w-[92%]"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/45 backdrop-blur-xl p-5 shadow-[0_12px_38px_hsl(var(--foreground)/0.08)]">
        <div className="pointer-events-none absolute -top-12 right-0 h-36 w-36 rounded-full bg-accent/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-4 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-[11px] font-body font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            Trip Copilot Ready
          </div>

          <div>
            <h3 className="text-xl font-body font-bold text-foreground leading-tight">
              Where should we take you next?
            </h3>
            <p className="mt-1 text-sm font-body text-muted-foreground">
              I&apos;ll tailor a route for {destination} with timing, map pins, and editable stops.
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-border/60 bg-card/65 p-3 backdrop-blur-sm">
            {previewPrompts.map((prompt, idx) => (
              <motion.div
                key={prompt}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 * idx, duration: 0.35 }}
                className="flex items-center gap-2 text-xs font-body text-muted-foreground"
              >
                <Compass className="h-3.5 w-3.5 text-primary" />
                <span>{prompt}</span>
              </motion.div>
            ))}
          </div>

          <Button
            onClick={onStart}
            className="w-full rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 font-body text-sm h-11 gap-2"
          >
            Start Chat Planning
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
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
    <div className="w-full max-w-[88%] rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 shadow-sm">
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map(opt => (
          <div key={opt.label} className="group relative">
            <button
              onClick={() => toggle(opt.label)}
              className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all pr-7 ${
                selected.includes(opt.label)
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
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
    <div className="w-full max-w-[88%] flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 shadow-sm">
      {PACE_OPTIONS.map(opt => (
        <button
          key={opt.label}
          onClick={() => onSelect(opt.label)}
          className="px-4 py-2.5 rounded-xl bg-secondary/90 text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-all text-sm font-body"
        >
          {opt.emoji} <span className="font-semibold">{opt.label}</span>
          <span className="block text-xs opacity-70">{opt.description}</span>
        </button>
      ))}
    </div>
  );
}

function LoadingAnimation() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-[85%] border border-border/60 bg-card/75 backdrop-blur-sm rounded-2xl rounded-tl-md p-6 flex flex-col items-center gap-3 shadow-sm">
      <svg width="136" height="44" viewBox="0 0 136 44" className="text-accent">
        <path
          d="M12 32 Q34 10 56 26 T98 16 T124 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="opacity-30"
        />
        <path
          d="M12 32 Q34 10 56 26 T98 16 T124 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="160"
          className="animate-draw-route"
        />
        <path
          d="M12 32 Q34 10 56 26 T98 16 T124 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="8 10"
          className="animate-route-flow opacity-80"
        />
        <circle cx="12" cy="32" r="4.5" fill="hsl(var(--primary))" className="animate-pin-pop" />
        <circle cx="124" cy="22" r="4.5" fill="hsl(var(--accent))" className="animate-pin-pop [animation-delay:220ms]" />
      </svg>

      <AnimatePresence mode="wait">
        <motion.p
          key={LOADING_STEPS[step]}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-body text-muted-foreground"
        >
          {LOADING_STEPS[step]}
          <span className="inline-flex ml-1">
            <span className="animate-typing-dot [animation-delay:0ms]">.</span>
            <span className="animate-typing-dot [animation-delay:160ms]">.</span>
            <span className="animate-typing-dot [animation-delay:320ms]">.</span>
          </span>
        </motion.p>
      </AnimatePresence>

      <div className="relative h-1.5 w-52 overflow-hidden rounded-full bg-secondary/80">
        <motion.div
          className="absolute left-0 top-0 h-full w-16 rounded-full bg-accent/85 shadow-[0_0_14px_hsl(var(--accent)/0.45)]"
          animate={{ x: ["-30%", "250%"] }}
          transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function StayIntentPicker({ onSelect }: { onSelect: (wantsStays: boolean) => void }) {
  return (
    <div className="w-full max-w-[88%] rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 shadow-sm">
      <p className="text-xs font-body text-muted-foreground mb-2">Add accommodation picks?</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(true)}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-body font-semibold hover:bg-primary/90 transition-colors"
        >
          Yes, find stays
        </button>
        <button
          onClick={() => onSelect(false)}
          className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-body font-semibold hover:bg-secondary/80 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function StayBudgetPicker({ onSelect }: { onSelect: (vibe: string) => void }) {
  return (
    <div className="w-full max-w-[92%] rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 shadow-sm">
      <p className="text-xs font-body text-muted-foreground mb-2">Pick a stay vibe</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {STAY_BUDGET_VIBES.map((option) => (
          <button
            key={option.label}
            onClick={() => onSelect(option.label)}
            className="rounded-xl border border-border/60 bg-card hover:bg-secondary/80 transition-colors text-left p-3"
          >
            <p className="text-xs font-body font-semibold text-foreground">{option.label}</p>
            <p className="text-[11px] font-body text-muted-foreground mt-1">{option.hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StayRecommendationsPanel({
  options,
  selectedOptions,
  budgetVibe,
  isLoading,
  onRetry,
  onAddToItinerary,
  onRemoveFromItinerary,
  onViewOnMap,
}: {
  options: StayOption[];
  selectedOptions: StayOption[];
  budgetVibe: string;
  isLoading: boolean;
  onRetry: () => void;
  onAddToItinerary: (stay: StayOption) => void;
  onRemoveFromItinerary: (stayId: string) => void;
  onViewOnMap: (stay: StayOption) => void;
}) {
  const selectedIds = new Set(selectedOptions.map((stay) => stay.id));

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-4">
        <p className="text-sm font-body text-muted-foreground">Finding top stays near your itinerary...</p>
      </div>
    );
  }

  if (!options.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 backdrop-blur-sm p-4">
        <p className="text-sm font-body text-foreground">No accommodation picks yet.</p>
        <p className="text-xs font-body text-muted-foreground mt-1">Ask Roamly to find stays and this tab will fill with recommendations.</p>
        <Button onClick={onRetry} size="sm" className="mt-3 rounded-lg text-xs font-body bg-accent text-accent-foreground hover:bg-accent/90">
          Find accommodations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BedDouble className="w-4 h-4 text-accent" />
          <p className="text-xs font-body font-semibold text-foreground">Stay recommendations</p>
        </div>
        {budgetVibe && <p className="text-[11px] font-body text-muted-foreground">{budgetVibe}</p>}
      </div>
      {selectedOptions.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-body font-semibold text-foreground">Saved in your Stays column</p>
          <div className="space-y-2">
            {selectedOptions.map((stay) => (
              <div key={`saved-${stay.id}`} className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onViewOnMap(stay)}
                    className="text-xs font-body font-semibold text-foreground hover:text-accent transition-colors"
                  >
                    {stay.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFromItinerary(stay.id)}
                    className="text-[11px] font-body text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <p className="mt-1 text-[11px] font-body text-muted-foreground">{stay.nightlyPrice} · {stay.neighborhood}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {options.map((stay) => (
          <div
            key={stay.id}
            className="w-full text-left rounded-2xl border border-border/60 bg-card/75 backdrop-blur-sm p-3 hover:border-accent/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-body font-semibold text-foreground">{stay.name}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-body text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {stay.type}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {stay.neighborhood}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-body font-semibold text-accent-foreground bg-accent/15 px-2 py-1 rounded-full">
                {stay.nightlyPrice}
              </span>
            </div>
            <p className="mt-2 text-xs font-body text-muted-foreground">{stay.why}</p>
            <p className="mt-2 text-[11px] font-body text-foreground/80">
              Best for: <span className="font-semibold">{stay.bestFor}</span>
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToItinerary(stay);
                }}
                disabled={selectedIds.has(stay.id)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-body font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-55 disabled:hover:bg-primary"
              >
                {selectedIds.has(stay.id) ? "Added to stays" : "Add to stays"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOnMap(stay);
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-body font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                View on map
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityAutocompleteInput({
  value,
  destination,
  onChange,
  onPlaceSelect,
  placeholder,
}: {
  value: string;
  destination: string;
  onChange: (value: string) => void;
  onPlaceSelect: (placeId: string | null) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocompleteInstance | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadTriggered = useRef(false);

  const triggerLoad = useCallback(() => {
    if (loadTriggered.current) return;
    loadTriggered.current = true;
    loadGoogleMaps().then(() => setIsLoaded(true)).catch(() => {
      // Silent fallback: typing still works and submit resolves with text search.
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;
    const gm = (window as Window & { google?: { maps?: GoogleMapsPlacesLike } }).google?.maps;
    if (!gm?.places?.Autocomplete) return;

    const autocomplete = new gm.places.Autocomplete(inputRef.current, {
      fields: ["place_id", "name", "formatted_address", "geometry"],
      types: ["establishment"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (typeof place.place_id === "string" && place.place_id.trim()) {
        onPlaceSelect(place.place_id);
      } else {
        onPlaceSelect(null);
      }

      const placeLabel = typeof place.name === "string" && place.name.trim()
        ? place.name.trim()
        : typeof place.formatted_address === "string" && place.formatted_address.trim()
          ? place.formatted_address.trim()
          : value;
      onChange(placeLabel);
    });

    autocompleteRef.current = autocomplete;
  }, [isLoaded, onChange, onPlaceSelect, value]);

  useEffect(() => {
    if (!isLoaded || !destination.trim()) return;
    const autocomplete = autocompleteRef.current;
    const gm = (window as Window & { google?: { maps?: GoogleMapsPlacesLike } }).google?.maps;
    if (!autocomplete || !gm?.Geocoder) return;

    let cancelled = false;
    const geocoder = new gm.Geocoder();
    geocoder.geocode({ address: destination }, (results, status) => {
      if (cancelled) return;
      const location = results?.[0]?.geometry?.location;
      if (status !== "OK" || !location) return;

      const lat = typeof location.lat === "function" ? location.lat() : location.lat;
      const lng = typeof location.lng === "function" ? location.lng() : location.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const latPad = 0.32;
      const lngPad = 0.45;
      autocomplete.setBounds({
        north: lat + latPad,
        south: lat - latPad,
        east: lng + lngPad,
        west: lng - lngPad,
      });
      autocomplete.setOptions({ strictBounds: false });
    });

    return () => {
      cancelled = true;
    };
  }, [destination, isLoaded]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => {
        onPlaceSelect(null);
        onChange(e.target.value);
      }}
      onFocus={triggerLoad}
      placeholder={placeholder}
      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-body focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function AddActivityForm({
  dayNumber,
  destination,
  value,
  onChange,
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  dayNumber: number;
  destination: string;
  value: { name: string; time: string; placeId: string | null };
  onChange: (next: { name: string; time: string; placeId: string | null }) => void;
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
        <ActivityAutocompleteInput
          value={value.name}
          destination={destination}
          onChange={(nextName) => onChange({ ...value, name: nextName, placeId: null })}
          onPlaceSelect={(placeId) => onChange({ ...value, placeId })}
          placeholder="Activity name (required)"
        />
        <input
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          placeholder="Time (optional, e.g., 2:00 PM)"
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
        We auto-find the place and pin it on the map from your activity keyword.
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
    <div className="w-full max-w-[88%] space-y-2 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 shadow-sm">
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
