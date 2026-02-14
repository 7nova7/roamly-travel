import { type Stop } from "@/data/demoTrip";

// Lucide-style SVG path data for activity icons
const ICON_PATHS: Record<string, string> = {
  "Food & Drink":
    "M3 2l0 6c0 1.1.9 2 2 2h2l0 12h2V10h2c1.1 0 2-.9 2-2V2M19 2v8a4 4 0 0 1-4 4M19 2v20",
  "Hiking & Nature":
    "m8 3 4 8 5-5 5 15H2L8 3z",
  "History & Culture":
    "M6 22V12a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10M2 22h20M12 2l10 5H2l10-5zM8 12v4M12 12v4M16 12v4",
  "Art & Music":
    "M12 2a5 5 0 0 1 5 5c0 2-1.5 3.5-3 4.5V22H10V11.5C8.5 10.5 7 9 7 7a5 5 0 0 1 5-5z",
  "Photography Spots":
    "M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5L14.5 4zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "Adventure Sports":
    "M2 22l5-5M7 17l3.5-3.5M14 14l-1-1M17.5 10.5L22 6M2 2l5 5M7 7l3.5 3.5",
  Shopping:
    "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  "Scenic Drives":
    "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2-3H8L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2M7 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM13 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  Nightlife:
    "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z",
  "Family Activities":
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  default:
    "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
};

function getIconPath(tags: string[]): string {
  for (const tag of tags) {
    if (ICON_PATHS[tag]) return ICON_PATHS[tag];
  }
  return ICON_PATHS.default;
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
  const iconPath = getIconPath(stop.tags);

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
            <path d="${iconPath}"/>
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
