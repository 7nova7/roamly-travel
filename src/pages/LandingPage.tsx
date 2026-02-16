import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Plane, TrainFront, DollarSign, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoamlyLogo } from "@/components/RoamlyLogo";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { DestinationCarousel } from "@/components/DestinationCarousel";
import { UserMenu } from "@/components/UserMenu";

const tripLengths = ["Day trip", "Weekend", "Full week", "Custom"];
const travelModes = [
{ icon: Plane, label: "Plane" },
{ icon: Car, label: "Car" },
{ icon: TrainFront, label: "Train" }];


export default function LandingPage() {
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tripLength, setTripLength] = useState("Weekend");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [mode, setMode] = useState("Car");

  const handlePlanTrip = () => {
    if (!from.trim() || !to.trim()) return;
    const budget = budgetAmount.trim() ? `$${budgetAmount.trim()}` : "No limit";
    navigate("/plan", { state: { from: from.trim(), to: to.trim(), days: tripLength, budget, mode } });
  };

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
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          src="/videos/hero-bg.mp4"
          className="absolute inset-0 w-full h-full object-cover -z-20"
        />
        <div className="absolute inset-0 bg-black/50 -z-10" />

        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white leading-tight mb-6">

            A to Everywhere, Smarter       
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

            {/* Trip Length */}
            <div className="mb-6">
              <label className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Trip Length</label>
              <div className="flex flex-wrap gap-2">
                {tripLengths.map((t) =>
                <button
                  key={t}
                  onClick={() => setTripLength(t)}
                  className={`px-4 py-2 rounded-full text-sm font-body font-medium transition-all ${
                  tripLength === t ?
                  "bg-primary text-primary-foreground shadow-md" :
                  "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`
                  }>

                    {t}
                  </button>
                )}
              </div>
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
              className="w-full h-14 text-lg font-body font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] animate-pulse-glow">

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

      {/* Testimonials */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-primary text-center mb-12">What travelers say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
            { name: "Sarah K.", quote: "Roamly saved us 3 hours of driving and found a hidden waterfall we never would've seen.", avatar: "S" },
            { name: "Marcus L.", quote: "It knew that the museum closed at 4pm and rearranged our whole day. Genius.", avatar: "M" },
            { name: "The Chen Family", quote: "Planning our cross-country trip went from stressful to genuinely fun. 10/10.", avatar: "C" }].
            map((t, i) =>
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm">

                <p className="text-foreground font-body mb-4 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-body font-bold text-sm">{t.avatar}</div>
                  <span className="font-body font-medium text-sm text-muted-foreground">{t.name}</span>
                </div>
              </motion.div>
            )}
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