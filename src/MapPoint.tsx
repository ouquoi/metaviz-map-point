import { useState } from "react";
import type { CustomVisualizationProps } from "@metabase/custom-viz";
import type { Settings } from "./types";
import { lerpColor, formatValue, isNumericCol, isTextCol, computeBounds, project } from "./utils";

const LEGEND_BAR_H = 10;
const LEGEND_GAP = 4;
const LEGEND_TEXT_H = 14;
const LEGEND_TITLE_H = 14;
const LEGEND_H_BASE = LEGEND_BAR_H + LEGEND_GAP + LEGEND_TEXT_H;
const LEGEND_MARGIN = 8;

type PointEntry = {
  key: number;
  label: string;
  lat: number;
  lon: number;
  value: number;
  rawRow: unknown[];
  rawLabel: unknown;
};

export function MapPoint({
  series,
  settings,
  width,
  height,
  colorScheme,
  onClick,
}: CustomVisualizationProps<Settings>) {
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const cw = (width ?? 0) > 0 ? Math.floor(width ?? 0) : 0;
  const ch = (height ?? 0) > 0 ? Math.floor(height ?? 0) : 0;
  if (!cw || !ch) return null;

  const dark = colorScheme === "dark";
  const bgColor = dark ? "#1c1c1c" : "#f8f9fa";
  const axisColor = dark ? "#9BA7B5" : "#6E7B8B";
  const borderColor = dark ? "#2d333b" : "#e0e0e0";

  const data = series?.[0]?.data;
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cols = data.cols as any[];
  const rows = data.rows as unknown[][];

  const labelIdx = cols.findIndex((c) => c.name === settings.labelColumn);
  const latIdx = cols.findIndex((c) => c.name === settings.latColumn);
  const lonIdx = cols.findIndex((c) => c.name === settings.lonColumn);
  const valueIdx = cols.findIndex((c) => c.name === settings.valueColumn);

  if (latIdx < 0 || lonIdx < 0) return null;

  const points: PointEntry[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawLat = row[latIdx];
    const rawLon = row[lonIdx];
    const lat = typeof rawLat === "number" ? rawLat : parseFloat(String(rawLat));
    const lon = typeof rawLon === "number" ? rawLon : parseFloat(String(rawLon));

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const rawLabel = labelIdx >= 0 ? row[labelIdx] : null;
    const label = rawLabel != null ? String(rawLabel) : `Point ${i + 1}`;

    const rawValue = valueIdx >= 0 ? row[valueIdx] : null;
    const value =
      rawValue != null
        ? typeof rawValue === "number"
          ? rawValue
          : parseFloat(String(rawValue))
        : 0;

    if (!isNaN(value) && value >= 0) {
      points.push({ key: i, label, lat, lon, value, rawRow: row, rawLabel });
    }
  }

  if (points.length === 0) return null;

  const bounds = computeBounds(points);
  if (!bounds) return null;

  const maxVal = Math.max(...points.map((p) => p.value));
  const minVal = Math.min(...points.map((p) => p.value));
  const valRange = maxVal - minVal || 1;

  const colorLow = settings.colorLow ?? "#ebedf0";
  const colorHigh = settings.colorHigh ?? "#509EE3";
  const baseRadius = Math.max(4, settings.pointSize ?? 7);
  const showLegend = settings.showLegend ?? true;
  const legendTitle = settings.legendTitle ?? "";

  const hasTitle = legendTitle.trim().length > 0;
  const LEGEND_H = LEGEND_H_BASE + (hasTitle ? LEGEND_TITLE_H + 2 : 0);
  const legendVisible = showLegend && ch >= 80 + LEGEND_H + LEGEND_MARGIN;
  const usedLegendH = legendVisible ? LEGEND_H + LEGEND_MARGIN : 0;

  const mapH = ch - usedLegendH;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const anyHovered = hoveredKey !== null;

  const pointEls = points.map((p, idx) => {
    const [px, py] = project(p.lat, p.lon, bounds, cw, mapH);
    const t = valRange > 0 ? (p.value - minVal) / valRange : 0;
    const fill = lerpColor(colorLow, colorHigh, t);
    const hovered = hoveredKey === p.key;
    const gOpacity = anyHovered ? (hovered ? 1 : 0.3) : 1;
    const delay = idx * 12;

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
          opacity={reducedMotion ? 1 : 0}
          style={{ cursor: "pointer" }}
          onMouseEnter={(e) => {
            setHoveredKey(p.key);
            setTooltip({
              x: e.clientX,
              y: e.clientY,
              text: valueIdx >= 0 ? `${p.label} · ${formatValue(p.value)}` : p.label,
            });
          }}
          onMouseMove={(e) => {
            setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
          }}
          onMouseLeave={() => {
            setHoveredKey(null);
            setTooltip(null);
          }}
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
        >
          {!reducedMotion && (
            <animate
              attributeName="opacity"
              from="0"
              to="1"
              dur="0.3s"
              begin={`${delay}ms`}
              fill="freeze"
            />
          )}
        </circle>
      </g>
    );
  });

  // Legend
  const legendW = Math.floor((cw - 32) / 2);
  const legendX = Math.round((cw - legendW) / 2);
  const legendY = mapH + LEGEND_MARGIN / 2;

  let legendEl: React.ReactElement | null = null;
  if (legendVisible && valueIdx >= 0) {
    const titleY = legendY + LEGEND_TITLE_H - 2;
    const barY = legendY + (hasTitle ? LEGEND_TITLE_H + 2 : 0);
    const valY = barY + LEGEND_BAR_H + LEGEND_GAP + LEGEND_TEXT_H - 2;
    legendEl = (
      <g>
        {hasTitle && (
          <text x={cw / 2} y={titleY} fontSize={10} fill={axisColor} textAnchor="middle" fontWeight="600" fontFamily="sans-serif">
            {legendTitle}
          </text>
        )}
        <rect x={legendX} y={barY} width={legendW} height={LEGEND_BAR_H} fill="url(#mp-legend-grad)" rx={3} />
        <text x={legendX} y={valY} fontSize={10} fill={axisColor} textAnchor="start" fontFamily="sans-serif">
          {formatValue(minVal)}
        </text>
        <text x={cw / 2} y={valY} fontSize={10} fill={axisColor} textAnchor="middle" fontFamily="sans-serif">
          {formatValue((minVal + maxVal) / 2)}
        </text>
        <text x={legendX + legendW} y={valY} fontSize={10} fill={axisColor} textAnchor="end" fontFamily="sans-serif">
          {formatValue(maxVal)}
        </text>
      </g>
    );
  }

  return (
    <div style={{ position: "relative", width: cw, height: ch, background: bgColor, overflow: "hidden" }}>
      <svg width={cw} height={ch}>
        <defs>
          <linearGradient id="mp-legend-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={colorLow} />
            <stop offset="100%" stopColor={colorHigh} />
          </linearGradient>
        </defs>

        {/* Map area border */}
        <rect x={0} y={0} width={cw} height={mapH} fill="none" stroke={borderColor} strokeWidth={1} />

        {pointEls}
        {legendEl}
      </svg>

      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y - 32,
            background: dark ? "#1F2335" : "#fff",
            border: `1px solid ${dark ? "#3A4060" : "#ddd"}`,
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            color: dark ? "#ccc" : "#333",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 9999,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
