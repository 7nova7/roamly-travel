import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypingIndicator } from "@/components/TypingIndicator";
import { DEMO_ITINERARY, INTEREST_OPTIONS, PACE_OPTIONS, DEMO_TRIP, type DayPlan } from "@/data/demoTrip";
import { DayCard } from "./DayCard";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  content: string;
  type: "text" | "interests" | "pace" | "input" | "loading" | "itinerary" | "actions";
}

interface ChatPanelProps {
  onHighlightStop: (stopId: string | null) => void;
  highlightedStop: string | null;
  onItineraryReady: (itinerary: DayPlan[]) => void;
}

export function ChatPanel({ onHighlightStop, highlightedStop, onItineraryReady }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // Start conversation
  useEffect(() => {
    if (phase === 0) {
      setPhase(1);
      addBotMessage(
        `Hey! 👋 I'm planning your ${DEMO_TRIP.days}-day trip from ${DEMO_TRIP.from} to ${DEMO_TRIP.to}. Before I build your itinerary, I want to make sure it's perfect for you.\n\nWhat kinds of experiences are you most into?`,
        "text",
        500
      );
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "interests", sender: "bot", content: "", type: "interests" }]);
      }, 1400);
    }
  }, [phase, addBotMessage]);

  const handleInterestSelect = (selected: string[]) => {
    addUserMessage(selected.join(", "));
    setTimeout(() => {
      addBotMessage("Great taste! Now, how do you like your days?", "text", 600);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "pace", sender: "bot", content: "", type: "pace" }]);
      }, 1500);
    }, 300);
  };

  const handlePaceSelect = (pace: string) => {
    addUserMessage(pace);
    setTimeout(() => {
      addBotMessage("One more — any must-see spots you already have in mind? Drop them here and I'll build around them.", "text", 600);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "spots-input", sender: "bot", content: "", type: "input" }]);
        setPhase(2);
      }, 1500);
    }, 300);
  };

  const handleSpotsSubmit = () => {
    const text = inputValue.trim() || "No specific spots — surprise me!";
    addUserMessage(text);
    setInputValue("");
    setTimeout(() => {
      addBotMessage("Perfect. Give me a moment to build something great... 🗺️", "text", 400);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "loading", sender: "bot", content: "", type: "loading" }]);
        // After loading, show itinerary
        setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== "loading"));
          setMessages(prev => [...prev, { id: "itinerary", sender: "bot", content: "", type: "itinerary" }]);
          onItineraryReady(DEMO_ITINERARY);
          setTimeout(() => {
            addBotMessage(
              "Here's your optimized plan! I clustered nearby stops together and ordered everything around opening hours. Want me to adjust anything?",
              "text",
              600
            );
            setTimeout(() => {
              setMessages(prev => [...prev, { id: "actions", sender: "bot", content: "", type: "actions" }]);
            }, 1400);
          }, 500);
        }, 2500);
      }, 1200);
    }, 300);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-body font-bold">R</div>
        <div>
          <p className="font-body font-semibold text-sm text-foreground">Roamly</p>
          <p className="text-xs text-muted-foreground font-body">AI Trip Planner</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
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
                      placeholder="e.g., Multnomah Falls, Powell's Books..."
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
              {msg.type === "itinerary" && (
                <div className="w-full space-y-4">
                  {DEMO_ITINERARY.map(day => (
                    <DayCard key={day.day} day={day} onHighlightStop={onHighlightStop} highlightedStop={highlightedStop} />
                  ))}
                </div>
              )}
              {msg.type === "actions" && <ActionChips />}
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
  const toggle = (label: string) => setSelected(prev => prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]);

  return (
    <div className="w-full max-w-[85%]">
      <div className="flex flex-wrap gap-2 mb-3">
        {INTEREST_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => toggle(opt.label)}
            className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all ${
              selected.includes(opt.label)
                ? "bg-accent text-accent-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            }`}
          >
            {opt.emoji} {opt.label}
          </button>
        ))}
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

function ActionChips() {
  return (
    <div className="w-full max-w-[85%] flex flex-wrap gap-2">
      {["Add more stops", "Make it more relaxed", "Swap Day 1 and 2", "Find restaurants near stops"].map(action => (
        <button
          key={action}
          className="px-3 py-1.5 rounded-full text-xs font-body font-medium bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-all border border-border/50"
        >
          {action}
        </button>
      ))}
    </div>
  );
}
