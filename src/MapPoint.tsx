import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CustomVisualizationProps } from "@metabase/custom-viz";
import type { Settings } from "./types";
import {
  lerpColor, formatValue, isNumericCol, isTextCol,
} from "./utils";

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

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
  const colorLow    = settings.colorLow ?? "#ebedf0";
  const colorHigh   = settings.colorHigh ?? "#509EE3";
  const baseRadius  = Math.max(4, settings.pointSize ?? 7);

  const hasTitle    = legendTitle.trim().length > 0;
  const LEGEND_H    = LEGEND_H_BASE + (hasTitle ? LEGEND_TITLE_H + 2 : 0);
  const legendVisible = showLegend && points.length > 0 && ch >= 80 + LEGEND_H + LEGEND_MARGIN;
  const usedLegendH   = legendVisible ? LEGEND_H + LEGEND_MARGIN : 0;
  const mapH = ch - usedLegendH;

  const maxVal  = points.length > 0 ? Math.max(...points.map((p) => p.value)) : 0;
  const minVal  = points.length > 0 ? Math.min(...points.map((p) => p.value)) : 0;
  const valRange = maxVal - minVal || 1;

  // Recompute map when these change — stringify for stable comparison
  const pointsKey = points.map((p) => `${p.lat},${p.lon},${p.value}`).join("|");
  const settingsKey = `${colorLow}|${colorHigh}|${baseRadius}|${settings.showTiles}|${dark}`;

  useEffect(() => {
    if (!mapContainerRef.current || points.length === 0) return;

    // Destroy previous instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const container = mapContainerRef.current;

    const map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });

    if (settings.showTiles ?? true) {
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
        maxZoom: 18,
      }).addTo(map);
    }

    points.forEach((p) => {
      const t = (p.value - minVal) / valRange;
      const fill = lerpColor(colorLow, colorHigh, t);

      const marker = L.circleMarker([p.lat, p.lon], {
        radius: baseRadius,
        fillColor: fill,
        fillOpacity: 0.9,
        color: "#ffffff",
        weight: 1.5,
      }).addTo(map);

      const popupContent = valueIdx >= 0
        ? `<b>${p.label}</b><br>${formatValue(p.value)}`
        : `<b>${p.label}</b>`;
      marker.bindPopup(popupContent);

      if (onClick && labelIdx >= 0) {
        marker.on("click", (e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (onClick as any)({
            value: p.rawLabel,
            column: cols[labelIdx],
            data: [
              { col: cols[labelIdx], value: p.rawLabel },
              ...(valueIdx >= 0 ? [{ col: cols[valueIdx], value: p.value }] : []),
            ],
            dimensions: [{ value: p.rawLabel, column: cols[labelIdx] }],
            event: e.originalEvent,
            origin: { row: p.rawRow, cols },
          });
        });
      }
    });

    // Fit all points
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [30, 30] });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, settingsKey, mapH]);

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

  return (
    <div style={{ position: "relative", width: cw, height: ch, background: bgColor, overflow: "hidden" }}>
      <div
        ref={mapContainerRef}
        style={{ width: cw, height: mapH }}
      />
      {legendEl}
    </div>
  );
}
