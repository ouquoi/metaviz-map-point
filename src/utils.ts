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

export const TILE_SIZE = 256;

// OSM/Mercator tile coordinate system
export function lonToTileX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

export function chooseZoom(
  minLat: number, maxLat: number,
  minLon: number, maxLon: number,
  svgW: number, svgH: number,
): number {
  for (let z = 14; z >= 0; z--) {
    const xSpan = (lonToTileX(maxLon, z) - lonToTileX(minLon, z)) * TILE_SIZE;
    const ySpan = (latToTileY(minLat, z) - latToTileY(maxLat, z)) * TILE_SIZE;
    if (xSpan <= svgW * 0.7 && ySpan <= svgH * 0.7) return z;
  }
  return 0;
}

export type MapTransform = {
  zoom: number;
  pxMin: number; pyMin: number;
  scale: number;
  offsetX: number; offsetY: number;
  txMin: number; txMax: number;
  tyMin: number; tyMax: number;
};

export function computeTransform(
  points: { lat: number; lon: number }[],
  svgW: number, svgH: number,
): MapTransform | null {
  if (points.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  if (minLat === maxLat) { minLat -= 0.5; maxLat += 0.5; }
  if (minLon === maxLon) { minLon -= 0.5; maxLon += 0.5; }

  const zoom = chooseZoom(minLat, maxLat, minLon, maxLon, svgW, svgH);
  const n = Math.pow(2, zoom);

  // Tile range covering bounds + 1 tile padding
  const txMin = Math.max(0, Math.floor(lonToTileX(minLon, zoom)) - 1);
  const txMax = Math.min(n - 1, Math.floor(lonToTileX(maxLon, zoom)) + 1);
  const tyMin = Math.max(0, Math.floor(latToTileY(maxLat, zoom)) - 1);
  const tyMax = Math.min(n - 1, Math.floor(latToTileY(minLat, zoom)) + 1);

  const pxMin = txMin * TILE_SIZE;
  const pyMin = tyMin * TILE_SIZE;
  const pxMax = (txMax + 1) * TILE_SIZE;
  const pyMax = (tyMax + 1) * TILE_SIZE;

  const scaleX = svgW / (pxMax - pxMin);
  const scaleY = svgH / (pyMax - pyMin);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (svgW - (pxMax - pxMin) * scale) / 2;
  const offsetY = (svgH - (pyMax - pyMin) * scale) / 2;

  return { zoom, pxMin, pyMin, scale, offsetX, offsetY, txMin, txMax, tyMin, tyMax };
}

export function projectPoint(lat: number, lon: number, t: MapTransform): [number, number] {
  const px = lonToTileX(lon, t.zoom) * TILE_SIZE;
  const py = latToTileY(lat, t.zoom) * TILE_SIZE;
  return [t.offsetX + (px - t.pxMin) * t.scale, t.offsetY + (py - t.pyMin) * t.scale];
}
