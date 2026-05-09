export interface Game {
  id: string;
  title: string;
  coverUrl: string;
  hoursPlayed: number;
  hltbMain: number;
  hltbCompletionist: number;
  platform: "steam" | "epic" | "local" | string;
  lastPlayed: string;
  isRunning?: boolean;
  execPath?: string;
  steamId?: string;
}

export const mockGames: Game[] = [
  {
    id: "1",
    title: "Elden Ring",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900_2x.jpg",
    hoursPlayed: 87.3,
    hltbMain: 55,
    hltbCompletionist: 133,
    platform: "steam",
    lastPlayed: "2026-04-07",
  },
  {
    id: "2",
    title: "Hades",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1145360/library_600x900_2x.jpg",
    hoursPlayed: 42.1,
    hltbMain: 22,
    hltbCompletionist: 96,
    platform: "steam",
    lastPlayed: "2026-04-05",
  },
  {
    id: "3",
    title: "Hollow Knight",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900_2x.jpg",
    hoursPlayed: 31.5,
    hltbMain: 27,
    hltbCompletionist: 63,
    platform: "steam",
    lastPlayed: "2026-03-28",
  },
  {
    id: "4",
    title: "Cyberpunk 2077",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900_2x.jpg",
    hoursPlayed: 65.0,
    hltbMain: 24,
    hltbCompletionist: 103,
    platform: "steam",
    lastPlayed: "2026-04-01",
  },
  {
    id: "5",
    title: "Celeste",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/504230/library_600x900_2x.jpg",
    hoursPlayed: 12.4,
    hltbMain: 8,
    hltbCompletionist: 36,
    platform: "epic",
    lastPlayed: "2026-03-15",
  },
  {
    id: "6",
    title: "Stardew Valley",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/413150/library_600x900_2x.jpg",
    hoursPlayed: 120.7,
    hltbMain: 52,
    hltbCompletionist: 153,
    platform: "steam",
    lastPlayed: "2026-04-06",
  },
  {
    id: "7",
    title: "DOOM Eternal",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/782330/library_600x900_2x.jpg",
    hoursPlayed: 18.2,
    hltbMain: 14,
    hltbCompletionist: 27,
    platform: "steam",
    lastPlayed: "2026-02-20",
  },
  {
    id: "8",
    title: "The Witcher 3",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/292030/library_600x900_2x.jpg",
    hoursPlayed: 156.0,
    hltbMain: 52,
    hltbCompletionist: 187,
    platform: "steam",
    lastPlayed: "2025-12-10",
  },
  {
    id: "9",
    title: "Sekiro",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/814380/library_600x900_2x.jpg",
    hoursPlayed: 38.9,
    hltbMain: 30,
    hltbCompletionist: 75,
    platform: "steam",
    lastPlayed: "2026-03-01",
  },
  {
    id: "10",
    title: "Disco Elysium",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/632470/library_600x900_2x.jpg",
    hoursPlayed: 28.6,
    hltbMain: 20,
    hltbCompletionist: 43,
    platform: "epic",
    lastPlayed: "2026-01-22",
  },
  {
    id: "11",
    title: "Baldur's Gate 3",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/library_600x900_2x.jpg",
    hoursPlayed: 195.4,
    hltbMain: 90,
    hltbCompletionist: 160,
    platform: "steam",
    lastPlayed: "2026-04-08",
    isRunning: true,
  },
  {
    id: "12",
    title: "Dead Cells",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/588650/library_600x900_2x.jpg",
    hoursPlayed: 55.0,
    hltbMain: 14,
    hltbCompletionist: 88,
    platform: "steam",
    lastPlayed: "2026-03-18",
  },
];
