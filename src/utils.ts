export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [235, 237, 240];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export function lerpColor(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return `rgb(${Math.round(ra[0] + (rb[0] - ra[0]) * t)},${Math.round(ra[1] + (rb[1] - ra[1]) * t)},${Math.round(ra[2] + (rb[2] - ra[2]) * t)})`;
}

export function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString();
}

export function isNumericCol(col: { base_type?: string }): boolean {
  return /Integer|Float|Decimal|BigInteger|Number/i.test(col.base_type ?? "");
}

export function isTextCol(col: { base_type?: string }): boolean {
  return /Text|Name|String|UUID/i.test(col.base_type ?? "");
}

// Mercator y-projection for a latitude (returns value in [0,1] range for lat in [-85, 85])
export function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

export type Bounds = {
  minLat: number; maxLat: number;
  minLon: number; maxLon: number;
  minMercY: number; maxMercY: number;
};

export function computeBounds(points: { lat: number; lon: number }[]): Bounds | null {
  if (points.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  // Expand single-point bounds so projection doesn't divide by zero
  if (minLat === maxLat) { minLat -= 1; maxLat += 1; }
  if (minLon === maxLon) { minLon -= 1; maxLon += 1; }
  return { minLat, maxLat, minLon, maxLon, minMercY: mercatorY(minLat), maxMercY: mercatorY(maxLat) };
}

const PAD = 0.15; // 15% padding on each side

export function project(lat: number, lon: number, bounds: Bounds, w: number, h: number): [number, number] {
  const innerW = w * (1 - 2 * PAD);
  const innerH = h * (1 - 2 * PAD);
  const x = w * PAD + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * innerW;
  const my = mercatorY(lat);
  const y = h * PAD + (1 - (my - bounds.minMercY) / (bounds.maxMercY - bounds.minMercY)) * innerH;
  return [x, y];
}
