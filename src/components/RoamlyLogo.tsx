import { cn } from "@/lib/utils";

interface RoamlyLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
};

export function RoamlyLogo({ className, size = "md" }: RoamlyLogoProps) {
  return (
    <span className={cn("font-display font-bold tracking-tight", sizes[size], className)}>
      R
      <span className="relative inline-block">
        o
        <svg
          className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-[0.6em] h-[0.6em]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </span>
      amly
    </span>
  );
}
