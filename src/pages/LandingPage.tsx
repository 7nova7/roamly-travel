import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarIcon, Map, Check } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RoamlyLogo } from "@/components/RoamlyLogo";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { DestinationCarousel } from "@/components/DestinationCarousel";
import { UserMenu } from "@/components/UserMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DateRange } from "react-day-picker";
import { CityImage } from "@/components/CityImage";

const tripLengths = ["Day trip", "Weekend", "Full week"];
const budgetVibes = [
  { tier: "$", label: "Backpack & street snacks", hint: "Finds free gems and local cheap eats." },
  { tier: "$$", label: "Main character moments", hint: "A balanced mix of splurge and save." },
  { tier: "$$$", label: "Suite life energy", hint: "Premium picks, iconic spots, less compromise." },
];




export default function LandingPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [plannerStep, setPlannerStep] = useState<1 | 2>(1);
  const [plannerStarted, setPlannerStarted] = useState(false);
  const [roadTrip, setRoadTrip] = useState(false);
  const [tripLength, setTripLength] = useState("Weekend");
  const [dateMode, setDateMode] = useState<"flexible" | "specific">("flexible");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [budgetVibe, setBudgetVibe] = useState(budgetVibes[1].label);
  const handlePlanTrip = () => {
    if (!to.trim()) return;
    if (roadTrip && !from.trim()) return;

    const origin = roadTrip ? from.trim() : to.trim();
    const destination = to.trim();
    const selectedBudget = budgetVibes.find((option) => option.label === budgetVibe);
    const budget = `${selectedBudget?.tier || "$$"} ${budgetVibe}`;
    const mode = roadTrip ? "Car" : "Plane";

    if (dateMode === "specific" && dateRange?.from && dateRange?.to) {
      const numDays = differenceInDays(dateRange.to, dateRange.from) + 1;
      navigate("/plan", {
        state: {
          from: origin,
          to: destination,
          days: String(numDays),
          budget,
          mode,
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd")
        }
      });
    } else {
      navigate("/plan", { state: { from: origin, to: destination, days: tripLength, budget, mode } });
    }
  };

  const canMoveToStepTwo = to.trim() && (!roadTrip || from.trim());
  const canSubmit = canMoveToStepTwo && (dateMode === "flexible" || dateRange?.from && dateRange?.to);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <RoamlyLogo size="md" className="text-primary" />
          <UserMenu />
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="min-w-full min-h-full object-cover bg-black"
          >
            <source src="/videos/hero-bg.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 bg-black/50 z-[1]" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white leading-tight mb-6">

            Travel With Roamly, Making Trips Smarter                      
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-lg sm:text-xl text-white/80 font-body max-w-2xl mx-auto mb-12">

            Tell us where you're headed. We'll plan the smartest route — optimized around hours, distances, and what you actually love.
          </motion.p>

          {/* Trip Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white/12 backdrop-blur-2xl rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.35)] border border-white/25 p-6 sm:p-8 max-w-3xl mx-auto text-left">
            {plannerStarted && (
              <div className="flex items-center justify-end mb-4">
                <p className="text-xs font-body text-white/85">Step {plannerStep} of 2</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {!plannerStarted ? (
                <motion.div
                  key="planner-hook"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="relative overflow-hidden rounded-2xl border border-white/30 bg-white/10 backdrop-blur-xl p-6 sm:p-8"
                >
                  <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-accent/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-14 -left-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

                  <div className="relative flex flex-col items-center text-center">
                    <h3 className="text-3xl sm:text-4xl font-display font-semibold text-white">
                      Where is your next adventure?
                    </h3>
                    <p className="mt-3 text-base font-body text-white/80 max-w-xl">
                      Start a quick chat and I&apos;ll build a route that matches your timing, style, and must-see spots.
                    </p>

                    <Button
                      onClick={() => {
                        setPlannerStarted(true);
                        setPlannerStep(1);
                      }}
                      className="mt-6 h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold text-sm mx-auto"
                    >
                      Start chatting <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : plannerStep === 1 ? (
                <motion.div
                  key="planner-step-one"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5">
                    <p className="text-lg sm:text-xl font-display font-semibold text-primary mb-3">Where is your next adventure?</p>
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={{ duration: 0.28 }}
                      className="overflow-hidden"
                    >
                      <PlacesAutocomplete value={to} onChange={setTo} placeholder="Enter a city or destination" iconClassName="text-accent" />
                    </motion.div>

                    <button
                      onClick={() => {
                        setRoadTrip((prev) => !prev);
                      }}
                      className="mt-3 inline-flex items-center gap-2 text-xs font-body text-foreground"
                      type="button"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${roadTrip ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                        {roadTrip ? <Check className="w-3 h-3" /> : null}
                      </span>
                      Road trip
                    </button>
                  </div>

                  <AnimatePresence>
                    {roadTrip && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5">
                          <label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Where are you starting from?</label>
                          <PlacesAutocomplete value={from} onChange={setFrom} placeholder="Starting city" iconClassName="text-muted-foreground" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    onClick={() => setPlannerStep(2)}
                    disabled={!canMoveToStepTwo}
                    className="w-full h-12 text-base font-body font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="planner-step-two"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div>
                    <label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">When are you going?</label>
                    <div className="flex gap-2 mb-3">
                      {(["flexible", "specific"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setDateMode(m)}
                          className={`px-4 py-2 rounded-full text-sm font-body font-medium transition-all ${
                            dateMode === m
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                          }`}
                        >
                          {m === "flexible" ? "Flexible" : "Specific dates"}
                        </button>
                      ))}
                    </div>

                    {dateMode === "specific" ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-body font-medium text-foreground hover:bg-secondary/50 transition-all w-full sm:w-auto">
                            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                            {dateRange?.from && dateRange?.to ? (
                              <span>
                                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                                <span className="text-muted-foreground ml-1">
                                  ({differenceInDays(dateRange.to, dateRange.from)} nights)
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Pick your dates</span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={isMobile ? 1 : 2}
                            disabled={{ before: new Date() }}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {tripLengths.map((t) => (
                          <button
                            key={t}
                            onClick={() => setTripLength(t)}
                            className={`px-4 py-2 rounded-full text-sm font-body font-medium transition-all ${
                              tripLength === t
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Budget vibe</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {budgetVibes.map((option) => (
                        <button
                          key={option.label}
                          onClick={() => setBudgetVibe(option.label)}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            budgetVibe === option.label
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card border-border hover:bg-secondary/50"
                          }`}
                        >
                          <p className="text-xs font-body font-semibold">
                            <span className="mr-1">{option.tier}</span>
                            {option.label}
                          </p>
                          <p className={`text-[11px] font-body mt-1 ${budgetVibe === option.label ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{option.hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => setPlannerStep(1)}
                      variant="outline"
                      className="h-12 px-5 font-body"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handlePlanTrip}
                      disabled={!canSubmit}
                      className="flex-1 h-12 text-base font-body font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                    >
                      Plan My Trip <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Destination Carousel */}
      <DestinationCarousel />

      {/* How it works */}
      <section className="py-24 px-4 sm:px-6 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-display font-bold text-primary text-center mb-16">

            How Roamly Works
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
            { step: "1", title: "Tell us your trip", desc: "Enter your start, destination, dates, and budget. It takes 30 seconds.", icon: "🗺️" },
            { step: "2", title: "We learn what you love", desc: "Our AI asks smart questions to personalize every stop to your interests.", icon: "💡" },
            { step: "3", title: "Get an optimized itinerary", desc: "Receive a constraint-aware plan that clusters stops efficiently and respects opening hours.", icon: "✨" }].
            map((item, i) =>
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center p-8">

                <div className="text-5xl mb-4">{item.icon}</div>
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center mx-auto mb-4">{item.step}</div>
                <h3 className="text-xl font-display font-semibold text-primary mb-2">{item.title}</h3>
                <p className="text-muted-foreground font-body">{item.desc}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Featured itineraries */}
      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-2xl font-display font-bold text-primary">Featured itineraries</h3>
              <p className="text-sm font-body text-muted-foreground mt-1">A few standout trips to spark your plan.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
            { title: "Paris Weekend", city: "Paris", duration: "Weekend", subtitle: "Bakeries + galleries + Seine at dusk", tag: "Weekend", stops: ["Le Marais", "Louvre loop", "Montmartre"] },
            { title: "Tokyo Full Week", city: "Tokyo", duration: "Full week", subtitle: "Neighborhood loops + ramen + shrine mornings", tag: "Full week", stops: ["Shibuya", "Asakusa", "Omoide Yokocho"] },
            { title: "San Francisco Day Trip", city: "San Francisco", duration: "Day trip", subtitle: "Waterfront + hidden stairs + Mission murals", tag: "Day trip", stops: ["Ferry Building", "Lombard views", "Dolores Park"] }].
            map((item, i) =>
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm hover:shadow-md transition-shadow">

                <CityImage
                city={item.city}
                size="900x520"
                alt={`${item.city} itinerary`}
                className="w-full h-36 rounded-xl mb-4" />

                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-body font-semibold text-foreground">{item.title}</p>
                  <span className="text-[10px] font-body font-semibold text-accent-foreground bg-accent/10 px-2 py-1 rounded-full">
                    {item.tag}
                  </span>
                </div>
                <p className="text-xs font-body text-muted-foreground">{item.subtitle}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {item.stops.map((stop) =>
                <span key={stop} className="text-[10px] font-body text-muted-foreground bg-secondary/60 px-2 py-1 rounded-full">
                      {stop}
                    </span>
                )}
                </div>
                <button
                onClick={() => navigate(`/itineraries?city=${encodeURIComponent(item.city)}&duration=${encodeURIComponent(item.duration)}`)}
                className="mt-4 text-xs font-body font-medium text-accent hover:underline">

                  View sample →
                </button>
              </motion.div>
            )}
          </div>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => navigate("/itineraries")}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-xs font-body font-medium text-foreground hover:bg-secondary/60 transition-colors"
              aria-label="See all example itineraries">

              <Map className="w-4 h-4 text-accent" />
              See all itineraries
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <RoamlyLogo size="sm" className="text-primary" />
          <p className="text-sm text-muted-foreground font-body">© 2026 Roamly. Travel more. Plan smarter.</p>
        </div>
      </footer>
    </div>);

}
