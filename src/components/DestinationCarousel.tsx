import { useEffect, useRef, type WheelEvent } from "react";
import { useNavigate } from "react-router-dom";

interface Destination {
  city: string;
  title: string;
  image: string;
  days: string;
  mode: string;
}

const row1: Destination[] = [
  { city: "New York", title: "A NYC Classic", image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Tokyo", title: "Urban Adventure in Tokyo", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Paris", title: "Parisian Escape", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Barcelona", title: "Sun & Culture in Barcelona", image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "London", title: "London Highlights", image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Cancún", title: "Beach Bliss in Cancún", image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Toronto", title: "Toronto Weekend Getaway", image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?w=600&q=80", days: "Weekend", mode: "Plane" },
  { city: "Rome", title: "Roman Holiday", image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Bali", title: "Island Vibes in Bali", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", days: "Full week", mode: "Plane" },
];

const row2: Destination[] = [
  { city: "Sydney", title: "Sydney & Beyond", image: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=600&q=80", days: "Weekend", mode: "Plane" },
  { city: "Dubai", title: "Desert & Skyline in Dubai", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Marrakech", title: "Marrakech Discovery", image: "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=600&q=80", days: "Weekend", mode: "Plane" },
  { city: "Reykjavik", title: "Iceland in a Weekend", image: "https://images.unsplash.com/photo-1529963183134-61a90db47eaf?w=600&q=80", days: "Weekend", mode: "Plane" },
  { city: "Cape Town", title: "Cape Town Adventure", image: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Bangkok", title: "Bangkok Street Crawl", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", days: "Weekend", mode: "Plane" },
  { city: "Lisbon", title: "Lisbon Long Weekend", image: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=600&q=80", days: "Weekend", mode: "Plane" },
  { city: "Buenos Aires", title: "Tango in Buenos Aires", image: "https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=600&q=80", days: "Full week", mode: "Plane" },
  { city: "Kyoto", title: "Temples of Kyoto", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80", days: "Full week", mode: "Plane" },
];

function DestinationCard({ dest, onClick }: { dest: Destination; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative snap-start flex-shrink-0 w-[260px] h-[180px] sm:w-[280px] sm:h-[200px] rounded-2xl overflow-hidden group cursor-pointer"
    >
      <img
        src={dest.image}
        alt={dest.city}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-display font-semibold text-lg leading-tight drop-shadow-md">
          {dest.title}
        </p>
        <p className="text-white/80 font-body text-xs mt-0.5">{dest.days}</p>
      </div>
    </button>
  );
}

export function DestinationCarousel() {
  const navigate = useNavigate();
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);
  const pauseAutoUntilRef = useRef(0);
  const carryRef = useRef({ row1: 0, row2: 0 });

  const pauseAuto = (ms = 2200) => {
    pauseAutoUntilRef.current = Date.now() + ms;
  };

  const handleClick = (dest: Destination) => {
    navigate("/plan", {
      state: {
        from: dest.city,
        to: dest.city,
        days: dest.days,
        budget: "No limit",
        mode: dest.mode,
      },
    });
  };

  const handleHorizontalWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    container.scrollLeft += event.deltaY;
    pauseAuto();
    event.preventDefault();
  };

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    const primeReverseRow = () => {
      const row = row2Ref.current;
      if (!row || row.scrollWidth <= row.clientWidth) return;
      row.scrollLeft = row.scrollWidth / 2;
    };
    primeReverseRow();
    window.addEventListener("resize", primeReverseRow);

    const step = (ts: number) => {
      const delta = ts - lastTs;
      lastTs = ts;
      const isMobileViewport = window.matchMedia("(max-width: 639px)").matches;
      const paused = Date.now() < pauseAutoUntilRef.current;

      if (!paused) {
        const advanceRow = (
          element: HTMLDivElement | null,
          speedPxPerSecond: number,
          direction: 1 | -1,
          key: "row1" | "row2",
        ) => {
          if (!element || element.scrollWidth <= element.clientWidth) return;

          const half = element.scrollWidth / 2;
          carryRef.current[key] += (speedPxPerSecond * delta) / 1000;
          const movePx = Math.floor(carryRef.current[key]);
          carryRef.current[key] -= movePx;
          if (movePx <= 0) return;

          if (direction === 1) {
            const next = element.scrollLeft + movePx;
            element.scrollLeft = next >= half ? next - half : next;
            return;
          }

          const next = element.scrollLeft - movePx;
          element.scrollLeft = next <= 0 ? next + half : next;
        };

        const row1Speed = isMobileViewport ? 18 : 34;
        const row2Speed = isMobileViewport ? 16 : 30;
        advanceRow(row1Ref.current, row1Speed, 1, "row1");
        advanceRow(row2Ref.current, row2Speed, -1, "row2");
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", primeReverseRow);
    };
  }, []);

  return (
    <section className="py-12">
      <h2 className="text-2xl sm:text-3xl font-display font-bold text-primary text-center mb-8">
        Popular Destinations
      </h2>

      {/* Row 1 — swipe/scroll (mobile + desktop mouse wheel) */}
      <div
        ref={row1Ref}
        onWheel={handleHorizontalWheel}
        onTouchStart={() => pauseAuto(3200)}
        onTouchMove={() => pauseAuto(3200)}
        className="mb-4 overflow-x-auto px-4 sm:px-0 snap-x snap-mandatory sm:snap-none [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex gap-4 w-max pr-4">
          {[...row1, ...row1].map((d, i) => (
            <DestinationCard key={`r1-${d.city}-${i}`} dest={d} onClick={() => handleClick(d)} />
          ))}
        </div>
      </div>

      {/* Row 2 — swipe/scroll (mobile + desktop mouse wheel) */}
      <div
        ref={row2Ref}
        onWheel={handleHorizontalWheel}
        onTouchStart={() => pauseAuto(3200)}
        onTouchMove={() => pauseAuto(3200)}
        className="overflow-x-auto px-4 sm:px-0 snap-x snap-mandatory sm:snap-none [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex gap-4 w-max pr-4">
          {[...row2, ...row2].map((d, i) => (
            <DestinationCard key={`r2-${d.city}-${i}`} dest={d} onClick={() => handleClick(d)} />
          ))}
        </div>
      </div>
    </section>
  );
}
