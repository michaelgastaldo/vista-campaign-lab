/**
 * Deterministic color assignment for calendar campaigns.
 * Each campaign id hashes to one of N curated oklch hues that sit
 * naturally on top of the dark glass surface.
 */

export type CalCampaignColor = {
  // Solid bar background (used at ~70% saturation)
  bar: string;
  // Strong edge (left accent stripe + hover ring)
  edge: string;
  // Soft tint for child-item chips inside day cells
  chip: string;
  // Dot for collapsed states
  dot: string;
  // Text on top of `bar`
  text: string;
};

// 10 hues spaced around the wheel, biased toward the brand's indigo/pink/violet range.
// Kept in oklch for parity with the rest of the design tokens.
const HUES = [275, 305, 340, 200, 165, 30, 55, 250, 360, 145];

const palette: CalCampaignColor[] = HUES.map((h) => ({
  bar: `oklch(0.62 0.18 ${h} / 0.85)`,
  edge: `oklch(0.78 0.22 ${h})`,
  chip: `oklch(0.7 0.16 ${h} / 0.22)`,
  dot: `oklch(0.78 0.22 ${h})`,
  text: `oklch(0.16 0.04 ${h})`,
}));

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export function colorForCampaign(id: string): CalCampaignColor {
  return palette[hash(id) % palette.length];
}
