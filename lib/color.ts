/** Deterministic per-card color. Hue is mode-independent (consistent card
 *  identity); lightness/saturation flip so night uses deep fills with light
 *  text and day uses pastel fills with dark text. */
export interface CardColor {
  fill: string;
  edge: string;
  text: string;
}

export type Theme = "night" | "day";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function colorForCard(id: string, theme: Theme = "night"): CardColor {
  const hue = hash(id) % 360;
  if (theme === "day") {
    return {
      fill: `hsl(${hue} 70% 88%)`,
      edge: `hsl(${hue} 55% 62%)`,
      text: `hsl(${hue} 45% 28%)`,
    };
  }
  return {
    fill: `hsl(${hue} 48% 26%)`,
    edge: `hsl(${hue} 70% 60%)`,
    text: `hsl(${hue} 45% 90%)`,
  };
}
