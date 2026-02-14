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

export const DEMO_TRIP = {
  from: "Seattle, WA",
  to: "Portland, OR",
  days: 3,
  budget: "$$",
  mode: "car" as const,
  interests: ["Hiking & Nature", "Food & Drink", "Scenic Drives"],
};

export const DEMO_ITINERARY: DayPlan[] = [
  {
    day: 1,
    title: "Seattle to Centralia",
    subtitle: "Nature & Scenic",
    totalDriving: "3h 20m",
    estimatedCost: "$85",
    color: "hsl(153, 44%, 17%)",
    stops: [
      {
        id: "d1s1",
        time: "9:00 AM",
        name: "Snoqualmie Falls",
        description: "Iconic 268-ft waterfall with easy viewpoint walk — a powerful start to your PNW adventure.",
        hours: "Open dawn–dusk",
        cost: "Free",
        lat: 47.5417,
        lng: -121.8367,
        tags: ["Nature", "Free"],
      },
      {
        id: "d1s2",
        time: "11:30 AM",
        name: "Twin Peaks Café, North Bend",
        description: "Famous Twin Peaks filming location. The cherry pie is legendary.",
        hours: "Open 8am–4pm",
        cost: "$",
        driveFromPrev: "15 min",
        lat: 47.4957,
        lng: -121.7868,
        tags: ["Food", "Culture"],
      },
      {
        id: "d1s3",
        time: "1:30 PM",
        name: "Mt. Rainier National Park",
        description: "Stunning alpine views and short hikes at the Sunrise Visitor Area.",
        hours: "Open 10am–6pm",
        cost: "$30 entry",
        driveFromPrev: "1h 45m",
        lat: 46.9142,
        lng: -121.6438,
        tags: ["Nature", "Hiking"],
      },
      {
        id: "d1s4",
        time: "5:00 PM",
        name: "Centralia, WA",
        description: "Charming small town for an overnight rest. Great antique shops downtown.",
        hours: "Overnight stop",
        cost: "$$",
        driveFromPrev: "1h 20m",
        lat: 46.7162,
        lng: -122.9543,
        tags: ["Stay"],
      },
    ],
  },
  {
    day: 2,
    title: "Centralia to Columbia River Gorge",
    subtitle: "Adventure & Food",
    totalDriving: "2h 45m",
    estimatedCost: "$65",
    color: "hsl(210, 60%, 45%)",
    stops: [
      {
        id: "d2s1",
        time: "9:00 AM",
        name: "Olympic Club Hotel & Brewpub",
        description: "Historic brewpub with amazing breakfast — a Centralia institution since 1908.",
        hours: "Open 7am–10pm",
        cost: "$$",
        lat: 46.7168,
        lng: -122.9535,
        tags: ["Food", "Historic"],
      },
      {
        id: "d2s2",
        time: "11:00 AM",
        name: "Multnomah Falls",
        description: "Oregon's tallest waterfall at 627ft. The crown jewel of the Columbia Gorge.",
        hours: "Open 24hrs, lodge 9am–5pm",
        cost: "Free",
        driveFromPrev: "1h 30m",
        lat: 45.5762,
        lng: -122.1158,
        tags: ["Nature", "Free", "Must-see"],
      },
      {
        id: "d2s3",
        time: "1:30 PM",
        name: "Crown Point Vista House",
        description: "Panoramic gorge views from this beautifully restored 1917 observatory.",
        hours: "Open 9am–6pm",
        cost: "Free",
        driveFromPrev: "25 min",
        lat: 45.5390,
        lng: -122.2443,
        tags: ["Scenic", "Free", "Historic"],
      },
      {
        id: "d2s4",
        time: "3:30 PM",
        name: "Hood River",
        description: "Craft beer capital of Oregon with stunning waterfront and gorge views.",
        hours: "Various hours",
        cost: "$$",
        driveFromPrev: "50 min",
        lat: 45.7054,
        lng: -121.5215,
        tags: ["Food", "Drink", "Scenic"],
      },
    ],
  },
  {
    day: 3,
    title: "Hood River to Portland",
    subtitle: "Culture & Food",
    totalDriving: "2h 10m",
    estimatedCost: "$45",
    color: "hsl(28, 89%, 67%)",
    stops: [
      {
        id: "d3s1",
        time: "9:30 AM",
        name: "Timberline Lodge, Mt. Hood",
        description: "Iconic WPA-era lodge with jaw-dropping views of Mt. Hood. Free to visit.",
        hours: "Open 24hrs",
        cost: "Free to visit",
        lat: 45.3311,
        lng: -121.7113,
        tags: ["Scenic", "Historic", "Free"],
      },
      {
        id: "d3s2",
        time: "12:00 PM",
        name: "Portland Food Cart Pods",
        description: "50+ food carts on Hawthorne — some of the best street food in America.",
        hours: "Open 11am–8pm",
        cost: "$",
        driveFromPrev: "1h 15m",
        lat: 45.5118,
        lng: -122.6170,
        tags: ["Food", "Must-see"],
      },
      {
        id: "d3s3",
        time: "2:00 PM",
        name: "Powell's City of Books",
        description: "World's largest independent bookstore. An entire city block of books.",
        hours: "Open 10am–9pm",
        cost: "Free",
        driveFromPrev: "10 min",
        lat: 45.5231,
        lng: -122.6816,
        tags: ["Culture", "Free", "Must-see"],
      },
      {
        id: "d3s4",
        time: "4:00 PM",
        name: "Forest Park, Wildwood Trail",
        description: "5,200-acre urban forest — the perfect way to end your Pacific Northwest trip.",
        hours: "Open dawn–dusk",
        cost: "Free",
        driveFromPrev: "15 min",
        lat: 45.5357,
        lng: -122.7627,
        tags: ["Nature", "Hiking", "Free"],
      },
    ],
  },
];

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
