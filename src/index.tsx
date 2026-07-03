import { type CreateCustomVisualization, defineConfig } from "@metabase/custom-viz";
import { MapPoint } from "./MapPoint";
import type { Settings } from "./types";
import { isNumericCol, isTextCol } from "./utils";

const createVisualization: CreateCustomVisualization<Settings> = ({ defineSetting }) => {
  return defineConfig<Settings>({
    id: "map-point",
    getName: () => "Map Point",
    minSize: { width: 4, height: 3 },
    defaultSize: { width: 12, height: 6 },

    checkRenderable(series) {
      if (!series || series.length === 0) throw new Error("Select a latitude and a longitude column");
      const data = series[0]?.data;
      if (!data) throw new Error("Select a latitude and a longitude column");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cols = data.cols as any[];
      const numeric = cols.filter((c) => isNumericCol(c));
      if (numeric.length < 2) throw new Error("The query must return at least 2 numeric columns (latitude, longitude)");
    },

    settings: {
      // ── Data ──────────────────────────────────────────────────────────
      labelColumn: defineSetting({
        id: "labelColumn",
        title: "Label column",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return (cols.find((c) => isTextCol(c)) ?? cols[0])?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return { options: cols.map((c) => ({ name: c.display_name || c.name, value: c.name })) };
        },
      }),

      latColumn: defineSetting({
        id: "latColumn",
        title: "Latitude column",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          const numeric = cols.filter((c) => isNumericCol(c));
          return (numeric.find((c) => /lat/i.test(c.name)) ?? numeric[0])?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return { options: cols.filter((c) => isNumericCol(c)).map((c) => ({ name: c.display_name || c.name, value: c.name })) };
        },
      }),

      lonColumn: defineSetting({
        id: "lonColumn",
        title: "Longitude column",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          const numeric = cols.filter((c) => isNumericCol(c));
          return (numeric.find((c) => /lon|lng/i.test(c.name)) ?? numeric[1])?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return { options: cols.filter((c) => isNumericCol(c)).map((c) => ({ name: c.display_name || c.name, value: c.name })) };
        },
      }),

      valueColumn: defineSetting({
        id: "valueColumn",
        title: "Value column (color)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          const numeric = cols.filter((c) => isNumericCol(c));
          return (numeric.find((c) => !/lat|lon|lng/i.test(c.name)) ?? numeric[2])?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return { options: cols.filter((c) => isNumericCol(c)).map((c) => ({ name: c.display_name || c.name, value: c.name })) };
        },
      }),

      // ── Appearance ────────────────────────────────────────────────────
      pointSize: defineSetting({
        id: "pointSize",
        title: "Point size",
        widget: "number",
        getSection() { return "Appearance"; },
        getDefault() { return 7; },
      }),

      colorLow: defineSetting({
        id: "colorLow",
        title: "Color — low values",
        widget: "color",
        getSection() { return "Appearance"; },
        getDefault() { return "#ebedf0"; },
      }),

      colorHigh: defineSetting({
        id: "colorHigh",
        title: "Color — high values",
        widget: "color",
        getSection() { return "Appearance"; },
        getDefault() { return "#509EE3"; },
      }),

      showTiles: defineSetting({
        id: "showTiles",
        title: "Show map tiles (OpenStreetMap)",
        widget: "toggle",
        getSection() { return "Appearance"; },
        getDefault() { return true; },
      }),

      showLegend: defineSetting({
        id: "showLegend",
        title: "Show legend",
        widget: "toggle",
        getSection() { return "Appearance"; },
        getDefault() { return true; },
      }),

      legendTitle: defineSetting({
        id: "legendTitle",
        title: "Legend title",
        widget: "input",
        getSection() { return "Appearance"; },
        getDefault() { return ""; },
      }),
    },

    VisualizationComponent: MapPoint,
  });
};

export default createVisualization;
