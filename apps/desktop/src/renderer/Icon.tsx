import React from "react";
const paths: Record<string, string> = {
  pin: "m16 3 5 5-4 2-3 6-2-2-7 7m3-12 6-3 2-3M8 9l7 7",
  artist: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
  album: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  home: "m3 10 9-7 9 7v10H3Z M9 20v-7h6v7",
  library: "M4 4v16M9 4v16M14 4v16M18 4l4 15",
  search: "M21 21l-6-6 M17 10A7 7 0 1 1 3 10a7 7 0 0 1 14 0",
  tags: "M3 3h8l10 10-8 8L3 11Z M7 7h.01",
  stats: "M4 20V10h4v10m3 0V3h4v17m3 0v-8h4v8",
  settings:
    "M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  play: "m8 4 12 8-12 8Z",
  pause: "M8 4v16M16 4v16",
  next: "m4 5 12 7-12 7ZM20 5v14",
  previous: "m20 5-12 7 12 7ZM4 5v14",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  folder: "M3 6h7l2 3h9v11H3Z M3 6V4h7l2 2",
  refresh:
    "M20 7v5h-5M4 17v-5h5 M5 8a8 8 0 0 1 14-3l1 2M4 17l1 2a8 8 0 0 0 14-3",
  music:
    "M9 18V5l11-2v13M9 8l11-2 M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3 M20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3",
  lyrics: "M5 4h14v16H5Z M8 8h8M8 12h8M8 16h5",
  queue: "M4 5h16M4 10h16M4 15h10M4 20h10m4-5 4 3-4 3",
  list: "M4 5h16M4 10h16M4 15h16M4 20h16",
  shuffle: "M3 5h3l12 14h3M3 19h3l4-5m4-4 4-5h3m-3-2 3 2-3 2m0 10 3 2-3 2",
  repeat: "M3 8l3-3h13v5M21 16l-3 3H5v-5M3 8l3 3m15 5-3-3",
  volume: "M4 9h4l5-5v16l-5-5H4Z M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "m15 5-7 7 7 7",
  forward: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  minimize: "M4 12h16",
  maximize: "M4 4h16v16H4Z",
  restore: "M8 8h12v12H8Z M4 16V4h12",
  plus: "M12 4v16M4 12h16",
};
export function Icon({
  name,
  size = 21,
  filled = false,
}: {
  name: string;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.music} />
    </svg>
  );
}
