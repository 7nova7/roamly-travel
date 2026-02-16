import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Plane, TrainFront, DollarSign, ArrowRight, CalendarIcon, Map } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RoamlyLogo } from "@/components/RoamlyLogo";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { DestinationCarousel } from "@/components/DestinationCarousel";
import { UserMenu } from "@/components/UserMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DateRange } from "react-day-picker";
import { CityImage } from "@/components/CityImage";

const tripLengths = ["Day trip", "Weekend", "Full week", "Custom"];
const travelModes = [
{ icon: Plane, label: "Plane" },
{ icon: Car, label: "Car" },
{ icon: TrainFront, label: "Train" }];




export default function LandingPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tripLength, setTripLength] = useState("Weekend");
  const [dateMode, setDateMode] = useState<"flexible" | "specific">("flexible");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [mode, setMode] = useState("Car");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.src = "/videos/hero-bg.mp4";
      video.load();
      video.play().catch(() => {});
    }
  }, []);

  const handlePlanTrip = () => {
    if (!from.trim() || !to.trim()) return;
    const budget = budgetAmount.trim() ? `$${budgetAmount.trim()}` : "No limit";

    if (dateMode === "specific" && dateRange?.from && dateRange?.to) {
      const numDays = differenceInDays(dateRange.to, dateRange.from) + 1;
      navigate("/plan", {
        state: {
          from: from.trim(),
          to: to.trim(),
          days: String(numDays),
          budget,
          mode,
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd"),
        },
      });
    } else {
      navigate("/plan", { state: { from: from.trim(), to: to.trim(), days: tripLength, budget, mode } });
    }
  };

  const canSubmit = from.trim() && to.trim() && (dateMode === "flexible" || (dateRange?.from && dateRange?.to));

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
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="min-w-full min-h-full object-cover" />

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
            className="bg-card/90 backdrop-blur-xl rounded-2xl shadow-xl border border-border/60 p-6 sm:p-8 max-w-3xl mx-auto text-left">

            {/* From / To with Places Autocomplete */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">From</label>
                <PlacesAutocomplete value={from} onChange={setFrom} placeholder="Starting point" iconClassName="text-muted-foreground" />
              </div>
              <div>
                <label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">To</label>
                <PlacesAutocomplete value={to} onChange={setTo} placeholder="Destination" iconClassName="text-accent" />
              </div>
            </div>

            {/* When are you going? */}
            <div className="mb-6">
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
                    {m === "flexible" ? "Flexible" : "Specific Dates"}
                  </button>
                ))}
              </div>

              {dateMode === "flexible" ? (
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
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-body font-medium text-foreground hover:bg-secondary/50 transition-all w-full sm:w-auto">
                      <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                      {dateRange?.from && dateRange?.to ? (
                        <span>
                          {format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d")}
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
              )}
            </div>

            {/* Budget - Dollar Input */}
            <div className="mb-6">
              <label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Budget</label>
              <div className="relative max-w-[200px]">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="pl-9 font-body"
                  placeholder="e.g. 500"
                  min="0" />

              </div>
              <p className="text-xs text-muted-foreground font-body mt-1.5">Leave empty for no limit</p>
            </div>

            {/* Travel Mode */}
            <div className="mb-8">
              <label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Travel Mode</label>
              <div className="flex gap-3">
                {travelModes.map((m) =>
                <button
                  key={m.label}
                  onClick={() => setMode(m.label)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-body font-medium transition-all ${
                  mode === m.label ?
                  "bg-primary text-primary-foreground shadow-md" :
                  "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`
                  }>

                    <m.icon className="w-4 h-4" />
                    {m.label}
                  </button>
                )}
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={handlePlanTrip}
              disabled={!canSubmit}
              className="w-full h-14 text-lg font-body font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] animate-pulse-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">

              Plan My Trip <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
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
              { title: "San Francisco Day Trip", city: "San Francisco", duration: "Day trip", subtitle: "Waterfront + hidden stairs + Mission murals", tag: "Day trip", stops: ["Ferry Building", "Lombard views", "Dolores Park"] },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <CityImage
                  city={item.city}
                  size="900x520"
                  alt={`${item.city} itinerary`}
                  className="w-full h-36 rounded-xl mb-4"
                />
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-body font-semibold text-foreground">{item.title}</p>
                  <span className="text-[10px] font-body font-semibold text-accent-foreground bg-accent/10 px-2 py-1 rounded-full">
                    {item.tag}
                  </span>
                </div>
                <p className="text-xs font-body text-muted-foreground">{item.subtitle}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {item.stops.map((stop) => (
                    <span key={stop} className="text-[10px] font-body text-muted-foreground bg-secondary/60 px-2 py-1 rounded-full">
                      {stop}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => navigate(`/itineraries?city=${encodeURIComponent(item.city)}&duration=${encodeURIComponent(item.duration)}`)}
                  className="mt-4 text-xs font-body font-medium text-accent hover:underline"
                >
                  View sample →
                </button>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => navigate("/itineraries")}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-xs font-body font-medium text-foreground hover:bg-secondary/60 transition-colors"
              aria-label="See all example itineraries"
            >
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
          <p className="text-sm text-muted-foreground font-body">© 2026 Roamly. See more. Drive less.</p>
        </div>
      </footer>
    </div>);

}
