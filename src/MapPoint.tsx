import { useEffect, useRef, useState } from "react";
import type { CustomVisualizationProps } from "@metabase/custom-viz";
import type { Settings } from "./types";
import {
  lerpColor, formatValue, isNumericCol, isTextCol,
  TILE_SIZE, lonToTileX, latToTileY, tileXToLon, tileYToLat,
  autoFit, buildTileList, projectPoint,
  type MapState,
} from "./utils";

const LEGEND_BAR_H = 10;
const LEGEND_GAP = 4;
const LEGEND_TEXT_H = 14;
const LEGEND_TITLE_H = 14;
const LEGEND_H_BASE = LEGEND_BAR_H + LEGEND_GAP + LEGEND_TEXT_H;
const LEGEND_MARGIN = 8;

const TOOLTIP_W = 160;
const TOOLTIP_H = 58; // approximate card height
const ARROW_H = 6;

type PointEntry = {
  key: number;
  label: string;
  lat: number;
  lon: number;
  value: number;
  rawRow: unknown[];
  rawLabel: unknown;
};

type TooltipData = {
  svgX: number;
  svgY: number;
  label: string;
  value: number | null;
  colName: string;
  color: string;
};

export function MapPoint({
  series,
  settings,
  width,
  height,
  colorScheme,
  onClick,
}: CustomVisualizationProps<Settings>) {
  const cw = (width ?? 0) > 0 ? Math.floor(width ?? 0) : 0;
  const ch = (height ?? 0) > 0 ? Math.floor(height ?? 0) : 0;
  if (!cw || !ch) return null;

  const dark = colorScheme === "dark";
  const bgColor = dark ? "#1c1c1c" : "#f0f4f8";
  const axisColor = dark ? "#9BA7B5" : "#6E7B8B";

  const data = series?.[0]?.data;
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cols = data.cols as any[];
  const rows = data.rows as unknown[][];

  const labelIdx = cols.findIndex((c) => c.name === settings.labelColumn);
  const latIdx   = cols.findIndex((c) => c.name === settings.latColumn);
  const lonIdx   = cols.findIndex((c) => c.name === settings.lonColumn);
  const valueIdx = cols.findIndex((c) => c.name === settings.valueColumn);

  if (latIdx < 0 || lonIdx < 0) return null;

  const points: PointEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lat = typeof row[latIdx] === "number" ? row[latIdx] as number : parseFloat(String(row[latIdx]));
    const lon = typeof row[lonIdx] === "number" ? row[lonIdx] as number : parseFloat(String(row[lonIdx]));
    if (isNaN(lat) || isNaN(lon) || lat < -85 || lat > 85 || lon < -180 || lon > 180) continue;

    const rawLabel = labelIdx >= 0 ? row[labelIdx] : null;
    const label    = rawLabel != null ? String(rawLabel) : `Point ${i + 1}`;
    const rawValue = valueIdx >= 0 ? row[valueIdx] : null;
    const value    = rawValue != null
      ? (typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue)))
      : 0;
    if (isNaN(value)) continue;
    points.push({ key: i, label, lat, lon, value, rawRow: row, rawLabel });
  }

  const showLegend  = settings.showLegend ?? true;
  const legendTitle = settings.legendTitle ?? "";
  const showTiles   = settings.showTiles ?? true;
  const colorLow    = settings.colorLow ?? "#ebedf0";
  const colorHigh   = settings.colorHigh ?? "#509EE3";
  const baseRadius  = Math.max(4, settings.pointSize ?? 7);

  const hasTitle    = legendTitle.trim().length > 0;
  const LEGEND_H    = LEGEND_H_BASE + (hasTitle ? LEGEND_TITLE_H + 2 : 0);
  const legendVisible = showLegend && points.length > 0 && ch >= 80 + LEGEND_H + LEGEND_MARGIN;
  const usedLegendH   = legendVisible ? LEGEND_H + LEGEND_MARGIN : 0;
  const mapH = ch - usedLegendH;

  const maxVal   = points.length > 0 ? Math.max(...points.map((p) => p.value)) : 0;
  const minVal   = points.length > 0 ? Math.min(...points.map((p) => p.value)) : 0;
  const valRange = maxVal - minVal || 1;

  // ── Map state ─────────────────────────────────────────────────────────────
  const [mapState, setMapState] = useState<MapState | null>(null);
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; lat: number; lon: number } | null>(null);

  const pointsKey = points.map((p) => `${p.lat},${p.lon}`).join("|");

  // Auto-fit when data changes
  useEffect(() => {
    if (points.length === 0) return;
    setMapState(autoFit(points, cw, mapH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, cw, mapH]);

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;

      setMapState((prev) => {
        if (!prev) return prev;
        const newZoom = Math.max(0, Math.min(18, prev.zoom + delta));
        if (newZoom === prev.zoom) return prev;

        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const scaleFactor = Math.pow(2, newZoom - prev.zoom);

        const centerPxX = lonToTileX(prev.lon, prev.zoom) * TILE_SIZE;
        const centerPxY = latToTileY(prev.lat, prev.zoom) * TILE_SIZE;
        const pxMin = centerPxX - cw / 2;
        const pyMin = centerPxY - mapH / 2;

        const wx = pxMin + cursorX;
        const wy = pyMin + cursorY;

        const newPxMin = wx * scaleFactor - cursorX;
        const newPyMin = wy * scaleFactor - cursorY;

        const newCenterX = (newPxMin + cw / 2) / TILE_SIZE;
        const newCenterY = (newPyMin + mapH / 2) / TILE_SIZE;

        const newLon = tileXToLon(newCenterX, newZoom);
        const newLat = tileYToLat(newCenterY, newZoom);

        return {
          zoom: newZoom,
          lat: Math.max(-85, Math.min(85, newLat)),
          lon: ((newLon + 180) % 360 + 360) % 360 - 180,
        };
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [cw, mapH]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      lat: mapState?.lat ?? 0,
      lon: mapState?.lon ?? 0,
    };
    setIsDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !mapState) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;

    const n = Math.pow(2, mapState.zoom);
    const dLon = -dx * 360 / (TILE_SIZE * n);
    const startCyTile = latToTileY(dragRef.current.lat, mapState.zoom);
    const newCyTile = startCyTile - dy / TILE_SIZE;
    const newLat = tileYToLat(newCyTile, mapState.zoom);

    const newLon = dragRef.current.lon + dLon;

    setMapState({
      zoom: mapState.zoom,
      lat: Math.max(-85, Math.min(85, newLat)),
      lon: ((newLon + 180) % 360 + 360) % 360 - 180,
    });
  };

  const onMouseUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  // ── Touch handlers ─────────────────────────────────────────────────────────
  const touchRef = useRef<{ x: number; y: number; lat: number; lon: number; dist?: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        lat: mapState?.lat ?? 0,
        lon: mapState?.lon ?? 0,
      };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      touchRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        lat: mapState?.lat ?? 0,
        lon: mapState?.lon ?? 0,
        dist,
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchRef.current || !mapState) return;

    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchRef.current.x;
      const dy = e.touches[0].clientY - touchRef.current.y;
      const n = Math.pow(2, mapState.zoom);
      const dLon = -dx * 360 / (TILE_SIZE * n);
      const startCyTile = latToTileY(touchRef.current.lat, mapState.zoom);
      const newCyTile = startCyTile - dy / TILE_SIZE;
      const newLat = tileYToLat(newCyTile, mapState.zoom);
      const newLon = touchRef.current.lon + dLon;
      setMapState({
        zoom: mapState.zoom,
        lat: Math.max(-85, Math.min(85, newLat)),
        lon: ((newLon + 180) % 360 + 360) % 360 - 180,
      });
    } else if (e.touches.length === 2 && touchRef.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const ratio = newDist / touchRef.current.dist;
      const dz = Math.log2(ratio);
      const newZoom = Math.max(0, Math.min(18, Math.round(mapState.zoom + dz)));
      if (newZoom !== mapState.zoom) {
        touchRef.current.dist = newDist;
        setMapState((prev) => prev ? { ...prev, zoom: newZoom } : prev);
      }
    }
  };

  const onTouchEnd = () => { touchRef.current = null; };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!mapState || points.length === 0) {
    return <div style={{ width: cw, height: ch, background: bgColor }} />;
  }

  const tiles = showTiles ? buildTileList(mapState, cw, mapH) : [];
  const anyHovered = hoveredKey !== null;

  const pointEls = points.map((p) => {
    const [px, py] = projectPoint(p.lat, p.lon, mapState, cw, mapH);
    const t = (p.value - minVal) / valRange;
    const fill = lerpColor(colorLow, colorHigh, t);
    const hovered = hoveredKey === p.key;
    const gOpacity = anyHovered ? (hovered ? 1 : 0.3) : 1;

    return (
      <g key={p.key} opacity={gOpacity}>
        <circle
          cx={px}
          cy={py}
          r={baseRadius}
          fill={fill}
          fillOpacity={0.9}
          stroke="#fff"
          strokeWidth={1.5}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => {
            setHoveredKey(p.key);
            setTooltip({
              svgX: px,
              svgY: py,
              label: p.label,
              value: valueIdx >= 0 ? p.value : null,
              colName: valueIdx >= 0 ? (cols[valueIdx].display_name || cols[valueIdx].name || "") : "",
              color: fill,
            });
          }}
          onMouseLeave={() => { setHoveredKey(null); setTooltip(null); }}
          onClick={(e) => {
            if (onClick && labelIdx >= 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (onClick as any)({
                value: p.rawLabel,
                column: cols[labelIdx],
                data: [
                  { col: cols[labelIdx], value: p.rawLabel },
                  ...(valueIdx >= 0 ? [{ col: cols[valueIdx], value: p.value }] : []),
                ],
                dimensions: [{ value: p.rawLabel, column: cols[labelIdx] }],
                event: e.nativeEvent,
                origin: { row: p.rawRow, cols },
              });
            }
          }}
        />
      </g>
    );
  });

  // Legend
  const legendW = Math.floor((cw - 32) / 2);
  const legendX = Math.round((cw - legendW) / 2);
  const legendY = LEGEND_MARGIN / 2;

  let legendEl: React.ReactElement | null = null;
  if (legendVisible && valueIdx >= 0) {
    const titleY = legendY + LEGEND_TITLE_H - 2;
    const barY   = legendY + (hasTitle ? LEGEND_TITLE_H + 2 : 0);
    const valY   = barY + LEGEND_BAR_H + LEGEND_GAP + LEGEND_TEXT_H - 2;
    legendEl = (
      <svg
        style={{ position: "absolute", bottom: 0, left: 0, background: bgColor }}
        width={cw}
        height={usedLegendH}
      >
        <defs>
          <linearGradient id="mp-legend-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={colorLow} />
            <stop offset="100%" stopColor={colorHigh} />
          </linearGradient>
        </defs>
        {hasTitle && (
          <text x={cw / 2} y={titleY} fontSize={10} fill={axisColor} textAnchor="middle" fontWeight="600" fontFamily="sans-serif">
            {legendTitle}
          </text>
        )}
        <rect x={legendX} y={barY} width={legendW} height={LEGEND_BAR_H} fill="url(#mp-legend-grad)" rx={3} />
        <text x={legendX}           y={valY} fontSize={10} fill={axisColor} textAnchor="start"  fontFamily="sans-serif">{formatValue(minVal)}</text>
        <text x={cw / 2}            y={valY} fontSize={10} fill={axisColor} textAnchor="middle" fontFamily="sans-serif">{formatValue((minVal + maxVal) / 2)}</text>
        <text x={legendX + legendW} y={valY} fontSize={10} fill={axisColor} textAnchor="end"    fontFamily="sans-serif">{formatValue(maxVal)}</text>
      </svg>
    );
  }

  // Zoom button style
  const zoomBtnStyle: React.CSSProperties = {
    display: "block",
    width: 28,
    height: 28,
    background: dark ? "#2a2a2a" : "#fff",
    color: dark ? "#ccc" : "#333",
    border: `1px solid ${dark ? "#444" : "#ccc"}`,
    borderRadius: 4,
    fontSize: 18,
    lineHeight: "26px",
    textAlign: "center",
    cursor: "pointer",
    userSelect: "none",
    padding: 0,
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    marginBottom: 2,
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: cw,
        height: ch,
        background: bgColor,
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Map background */}
      <div style={{ position: "absolute", top: 0, left: 0, width: cw, height: mapH, background: dark ? "#2a2a2a" : "#e8eef4" }} />

      {/* OSM tile layer — HTML img elements clipped to map area */}
      {showTiles && (
        <div style={{ position: "absolute", top: 0, left: 0, width: cw, height: mapH, overflow: "hidden" }}>
          {tiles.map(({ tileX, tileY, x, y }) => (
            <img
              key={`${tileX}-${tileY}`}
              src={`https://tile.openstreetmap.org/${mapState.zoom}/${tileX}/${tileY}.png`}
              style={{
                position: "absolute",
                left: Math.round(x),
                top: Math.round(y),
                width: TILE_SIZE,
                height: TILE_SIZE,
                display: "block",
                pointerEvents: "none",
              }}
              alt=""
              draggable={false}
            />
          ))}
        </div>
      )}

      {/* SVG — points + attribution */}
      <svg
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        width={cw}
        height={mapH}
      >
        <clipPath id="mp-clip">
          <rect x={0} y={0} width={cw} height={mapH} />
        </clipPath>
        <g clipPath="url(#mp-clip)" style={{ pointerEvents: "all" }}>
          {pointEls}
        </g>
        {showTiles && (
          <text x={cw - 4} y={mapH - 4} fontSize={9} fill={dark ? "#888" : "#666"} textAnchor="end" fontFamily="sans-serif" style={{ pointerEvents: "none" }}>
            © OpenStreetMap contributors
          </text>
        )}
      </svg>

      {/* Zoom controls */}
      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, pointerEvents: "all" }}>
        <button
          style={zoomBtnStyle}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setMapState((prev) => prev ? { ...prev, zoom: Math.min(18, prev.zoom + 1) } : prev); }}
        >
          +
        </button>
        <button
          style={zoomBtnStyle}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setMapState((prev) => prev ? { ...prev, zoom: Math.max(0, prev.zoom - 1) } : prev); }}
        >
          −
        </button>
      </div>

      {legendEl}

      {/* Tooltip card */}
      {tooltip && (() => {
        const PIN_GAP = baseRadius + 4;
        // Default: above the pin
        let top = tooltip.svgY - PIN_GAP - TOOLTIP_H - ARROW_H;
        let arrowAbove = false; // arrow is below card (pointing down to pin)
        // Flip below if overflows top
        if (top < 4) {
          top = tooltip.svgY + PIN_GAP + ARROW_H;
          arrowAbove = true; // arrow is above card (pointing up to pin)
        }
        // Horizontal: center on pin, clamp to container
        let left = tooltip.svgX - TOOLTIP_W / 2;
        left = Math.max(4, Math.min(cw - TOOLTIP_W - 4, left));
        // Arrow X relative to card (clamped)
        const arrowRelX = Math.max(10, Math.min(TOOLTIP_W - 22, tooltip.svgX - left - 6));

        const cardBg = dark ? "#1F2335" : "#fff";
        const border = `1px solid ${dark ? "#3A4060" : "#e0e0e0"}`;
        const arrowBorderColor = dark ? "#1F2335" : "#fff";

        return (
          <div style={{ position: "absolute", top, left, width: TOOLTIP_W, pointerEvents: "none", zIndex: 9999 }}>
            {/* Arrow above card (tooltip is below pin) */}
            {arrowAbove && (
              <div style={{
                position: "absolute",
                top: -ARROW_H,
                left: arrowRelX,
                width: 0, height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderBottom: `${ARROW_H}px solid ${arrowBorderColor}`,
              }} />
            )}

            {/* Card */}
            <div style={{
              background: cardBg,
              border,
              borderRadius: 6,
              boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "row",
            }}>
              {/* Color strip */}
              <div style={{ width: 4, background: tooltip.color, flexShrink: 0 }} />
              {/* Content */}
              <div style={{ padding: "7px 10px", minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: dark ? "#e0e0e0" : "#1a1a1a",
                  fontFamily: "sans-serif",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {tooltip.label}
                </div>
                {tooltip.value !== null && (
                  <div style={{
                    fontSize: 11,
                    color: dark ? "#9BA7B5" : "#666",
                    fontFamily: "sans-serif",
                    marginTop: 2,
                    whiteSpace: "nowrap",
                  }}>
                    {tooltip.colName && <span style={{ fontWeight: 500 }}>{tooltip.colName} </span>}
                    {formatValue(tooltip.value)}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow below card (tooltip is above pin) */}
            {!arrowAbove && (
              <div style={{
                position: "absolute",
                bottom: -ARROW_H,
                left: arrowRelX,
                width: 0, height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: `${ARROW_H}px solid ${arrowBorderColor}`,
              }} />
            )}
          </div>
        );
      })()}
    </div>
  );
}
