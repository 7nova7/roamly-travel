export interface Stop {
  id: string;
  time: string;
  name: string;
  description: string;
  hours: string;
  cost: string;
  driveFromPrev?: string;
  lat: number;
  lng: number;
  tags: string[];
}

export interface DayPlan {
  day: number;
  title: string;
  subtitle: string;
  totalDriving: string;
  stops: Stop[];
  estimatedCost: string;
  color: string;
}

export interface TripConfig {
  from: string;
  to: string;
  days: string;
  budget: string;
  mode: string;
  startDate?: string;
  endDate?: string;
}

export const INTEREST_OPTIONS = [
  { emoji: "🥾", label: "Hiking & Nature" },
  { emoji: "🍺", label: "Food & Drink" },
  { emoji: "🏛️", label: "History & Culture" },
  { emoji: "🎨", label: "Art & Music" },
  { emoji: "🌙", label: "Nightlife" },
  { emoji: "👨‍👩‍👧", label: "Family Activities" },
  { emoji: "🛣️", label: "Scenic Drives" },
  { emoji: "🛍️", label: "Shopping" },
  { emoji: "🧗", label: "Adventure Sports" },
  { emoji: "📸", label: "Photography Spots" },
];

export const PACE_OPTIONS = [
  { label: "Relaxed", description: "2–3 stops/day", emoji: "🧘" },
  { label: "Balanced", description: "4–5 stops/day", emoji: "⚖️" },
  { label: "Adventure-packed", description: "6+ stops/day", emoji: "🚀" },
];
