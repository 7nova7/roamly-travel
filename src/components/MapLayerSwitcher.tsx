import { useState, useRef, useEffect } from "react";
import { Layers } from "lucide-react";
import { MAPBOX_STYLES } from "@/lib/mapbox";

interface MapLayerSwitcherProps {
  activeStyle: string;
  onStyleChange: (styleUrl: string, styleId: string) => void;
}

export function MapLayerSwitcher({ activeStyle, onStyleChange }: MapLayerSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="absolute top-3 right-3 z-20">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-xl bg-card/95 backdrop-blur-sm border border-border/60 shadow-lg flex items-center justify-center hover:bg-card transition-colors"
        title="Map layers"
      >
        <Layers className="w-5 h-5 text-foreground" />
      </button>

      {open && (
        <div className="absolute top-12 right-0 bg-card/95 backdrop-blur-sm rounded-xl border border-border/60 shadow-xl overflow-hidden min-w-[180px]">
          {MAPBOX_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => {
                onStyleChange(style.url, style.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-body font-medium transition-colors ${
                activeStyle === style.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <span className="text-base">{style.emoji}</span>
              {style.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
