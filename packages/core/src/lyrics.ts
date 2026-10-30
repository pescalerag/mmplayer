/** Pure LRC parsing, shared by the mobile and desktop players. */
export function parseLRC(lrcText: string): { time: number; text: string }[] {
  if (!lrcText) return [];
  const parsed: { time: number; text: string }[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  for (const line of lrcText.split(/\r?\n/)) {
    const matches = [...line.matchAll(timeRegex)];
    const text = line.replace(timeRegex, "").trim();
    for (const match of matches) {
      const milliseconds = Number(
        (match[3] || "00").padEnd(3, "0").slice(0, 3),
      );
      parsed.push({
        time: Number(match[1]) * 60 + Number(match[2]) + milliseconds / 1000,
        text,
      });
    }
  }
  return parsed.sort((a, b) => a.time - b.time);
}
