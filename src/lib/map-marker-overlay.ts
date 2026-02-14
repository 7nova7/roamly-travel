import { type Stop } from "@/data/demoTrip";

// Verified Lucide SVG path data for activity icons (multiple paths per icon)
const ICON_SVGS: Record<string, string[]> = {
  "Food & Drink": [
    // UtensilsCrossed
    "M16 2l-5.1 5.1M2 16l5.1-5.1",
    "m14.5 7.5-8 8",
    "m8.5 2.5 7 7",
    "m2.5 8.5 7 7",
    "M22 2 12 12",
  ],
  "Hiking & Nature": [
    // Mountain
    "m8 3 4 8 5-5 5 15H2L8 3z",
  ],
  "History & Culture": [
    // Landmark
    "M3 22h18",
    "M6 18v-7",
    "M10 18v-7",
    "M14 18v-7",
    "M18 18v-7",
    "M12 2L2 8h20L12 2z",
  ],
  "Art & Music": [
    // Palette
    "M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10c0 1.1-.9 2-2 2h-2.5c-1.1 0-2 .9-2 2 0 .5.2 1 .5 1.3.3.4.5.8.5 1.3 0 1.1-.9 2-2 2z",
    "M12 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z",
    "M8 10a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z",
    "M17 10a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z",
    "M14 7a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z",
  ],
  "Photography Spots": [
    // Camera
    "M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5L14.5 4z",
    "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ],
  "Adventure Sports": [
    // Bike
    "M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M19 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M12 17V5l-3 3",
    "M9 8h6",
  ],
  Shopping: [
    // ShoppingBag
    "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z",
    "M3 6h18",
    "M16 10a4 4 0 0 1-8 0",
  ],
  "Scenic Drives": [
    // Car
    "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-2-2.7-3.2C12 5.7 11 5 9 5c-1.4 0-3.3.3-5 1L2 7v9c0 .6.4 1 1 1h2",
    "M7 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
    "M13 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  ],
  Nightlife: [
    // Wine (glass)
    "M8 22h8",
    "M12 11v11",
    "M7.5 2h9l-1 7.4c-.3 2-1.9 3.6-3.9 3.6h-.2c-2 0-3.6-1.6-3.9-3.6L7.5 2z",
  ],
  "Family Activities": [
    // Users
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  default: [
    // MapPin
    "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z",
    "M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  ],
};

// Keywords to match tags more flexibly
const TAG_KEYWORDS: [string[], string][] = [
  [["food", "drink", "restaurant", "dining", "eat", "cafe", "coffee", "bar", "brewery"], "Food & Drink"],
  [["hik", "nature", "trail", "mountain", "park", "outdoor", "garden", "forest", "lake", "waterfall", "beach"], "Hiking & Nature"],
  [["histor", "culture", "museum", "heritage", "monument", "landmark", "temple", "church", "castle"], "History & Culture"],
  [["art", "music", "gallery", "theater", "theatre", "concert", "paint"], "Art & Music"],
  [["photo", "view", "scenic", "overlook", "vista", "sunset", "sunrise"], "Photography Spots"],
  [["adventure", "sport", "climb", "surf", "kayak", "ski", "bike", "cycle", "rafting", "zip"], "Adventure Sports"],
  [["shop", "market", "mall", "boutique", "store"], "Shopping"],
  [["drive", "road", "highway", "route", "car"], "Scenic Drives"],
  [["night", "club", "lounge", "pub", "cocktail"], "Nightlife"],
  [["family", "kid", "child", "amusement", "zoo", "aquarium", "playground"], "Family Activities"],
];

function getIconPaths(tags: string[]): string[] {
  // Direct match first
  for (const tag of tags) {
    if (ICON_SVGS[tag]) return ICON_SVGS[tag];
  }
  // Keyword match
  const tagStr = tags.join(" ").toLowerCase();
  for (const [keywords, category] of TAG_KEYWORDS) {
    if (keywords.some(k => tagStr.includes(k))) {
      return ICON_SVGS[category];
    }
  }
  return ICON_SVGS.default;
}

export interface MarkerOverlayInstance {
  setHighlighted: (h: boolean) => void;
  remove: () => void;
}

export function createMarkerOverlay(
  stop: Stop,
  dayColor: string,
  map: any,
  onHover: (id: string | null) => void,
  onClick: (name: string, lat: number, lng: number) => void,
): MarkerOverlayInstance {
  const gm = (window as any).google.maps;
  const position = new gm.LatLng(stop.lat, stop.lng);
  const iconPaths = getIconPaths(stop.tags);

  let div: HTMLDivElement | null = null;
  let highlighted = false;

  const overlay = new gm.OverlayView();

  overlay.onAdd = function () {
    div = document.createElement("div");
    div.style.position = "absolute";
    div.style.cursor = "pointer";
    div.style.transition = "transform 0.2s ease, box-shadow 0.2s ease";
    div.style.zIndex = "10";

    div.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          background: white;
          border: 2px solid transparent;
          border-radius: 20px;
          padding: 4px 10px 4px 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          white-space: nowrap;
          font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif;
          max-width: 180px;
        " class="marker-pill">
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${dayColor};
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${iconPaths.map(p => `<path d="${p}"/>`).join("")}
            </svg>
          </div>
          <span style="
            font-size: 12px;
            font-weight: 600;
            color: #1a1a1a;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.2;
          ">${stop.name}</span>
        </div>
        <div style="
          width: 2px;
          height: 10px;
          background: ${dayColor};
        "></div>
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${dayColor};
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        "></div>
      </div>
    `;

    div.addEventListener("mouseenter", () => onHover(stop.id));
    div.addEventListener("mouseleave", () => onHover(null));
    div.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      onClick(stop.name, stop.lat, stop.lng);
    });

    const panes = overlay.getPanes();
    panes?.overlayMouseTarget.appendChild(div);
  };

  overlay.draw = function () {
    if (!div) return;
    const projection = overlay.getProjection();
    if (!projection) return;
    const point = projection.fromLatLngToDivPixel(position);
    if (point) {
      div.style.left = `${point.x}px`;
      div.style.top = `${point.y}px`;
      div.style.transform = `translate(-50%, -100%) ${highlighted ? "scale(1.1)" : "scale(1)"}`;
    }
  };

  overlay.onRemove = function () {
    if (div) {
      div.parentNode?.removeChild(div);
      div = null;
    }
  };

  overlay.setMap(map);

  return {
    setHighlighted(h: boolean) {
      highlighted = h;
      if (!div) return;
      const pill = div.querySelector(".marker-pill") as HTMLElement;
      if (pill) {
        pill.style.borderColor = h ? dayColor : "transparent";
        pill.style.boxShadow = h
          ? "0 4px 16px rgba(0,0,0,0.25)"
          : "0 2px 8px rgba(0,0,0,0.15)";
      }
      div.style.zIndex = h ? "100" : "10";
      overlay.draw();
    },
    remove() {
      overlay.setMap(null);
    },
  };
}
