function luminance(hex: string): number {
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

/** WCAG AA large-text contrast (3:1), using GTFS default route colors. */
export function hasValidContrast(
  background: string | null,
  foreground: string | null,
): boolean {
  const bg = background || 'FFFFFF';
  const fg = foreground || '000000';
  if (!/^[0-9a-f]{6}$/i.test(bg) || !/^[0-9a-f]{6}$/i.test(fg)) {
    return false;
  }
  const a = luminance(bg);
  const b = luminance(fg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 3;
}
