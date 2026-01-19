/**
 * ColorBrewer-inspired qualitative color palette optimized for map visualization.
 * Uses saturated colors from ColorBrewer Set1 and Set2 for better visibility on maps.
 * Colors are chosen for:
 * - Strong visual distinctness
 * - Good contrast on light map backgrounds
 * - Aesthetic appeal
 * - Colorblind-friendly where possible
 */
const QUALITATIVE_COLORS = [
  '#E41A1C', // Red
  '#377EB8', // Blue
  '#4DAF4A', // Green
  '#984EA3', // Purple
  '#FF7F00', // Orange
  '#FFFF33', // Yellow
  '#A65628', // Brown
  '#F781BF', // Pink
  '#999999', // Gray
  '#66C2A5', // Teal
  '#FC8D62', // Coral
  '#8DA0CB', // Periwinkle
  '#E78AC3', // Rose
  '#A6D854', // Lime
  '#FFD92F', // Gold
  '#E5C494', // Tan
  '#B3B3B3', // Light Gray
  '#8DD3C7', // Mint
];

export function distinctRouteColor(index: number) {
  // Cycle through the qualitative color palette
  return QUALITATIVE_COLORS[index % QUALITATIVE_COLORS.length];
}

export function darkenHex(hex: string, amount = 0.18) {
  // amount: 0..1
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, Math.floor(parseInt(n.slice(0, 2), 16) * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.floor(parseInt(n.slice(2, 4), 16) * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.floor(parseInt(n.slice(4, 6), 16) * (1 - amount))));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

