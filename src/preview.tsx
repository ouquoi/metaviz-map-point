import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MapPoint } from "./MapPoint";
import type { Settings } from "./types";

const MOCK_PLACES = [
  { name: "Paris",       lat: 48.8566,  lon: 2.3522,   value: 312 },
  { name: "Lyon",        lat: 45.7640,  lon: 4.8357,   value: 187 },
  { name: "Marseille",   lat: 43.2965,  lon: 5.3698,   value: 241 },
  { name: "Toulouse",    lat: 43.6047,  lon: 1.4442,   value: 156 },
  { name: "Bordeaux",    lat: 44.8378,  lon: -0.5792,  value: 134 },
  { name: "Nantes",      lat: 47.2184,  lon: -1.5536,  value: 118 },
  { name: "Strasbourg",  lat: 48.5734,  lon: 7.7521,   value: 97  },
  { name: "Lille",       lat: 50.6292,  lon: 3.0573,   value: 143 },
  { name: "Nice",        lat: 43.7102,  lon: 7.2620,   value: 89  },
  { name: "Rennes",      lat: 48.1173,  lon: -1.6778,  value: 76  },
  { name: "Montpellier", lat: 43.6108,  lon: 3.8767,   value: 112 },
  { name: "Grenoble",    lat: 45.1885,  lon: 5.7245,   value: 68  },
];

const MOCK_SERIES = [
  {
    data: {
      cols: [
        { name: "city",       display_name: "City",       base_type: "type/Text" },
        { name: "latitude",   display_name: "Latitude",   base_type: "type/Float" },
        { name: "longitude",  display_name: "Longitude",  base_type: "type/Float" },
        { name: "validations",display_name: "Validations",base_type: "type/Integer" },
      ],
      rows: MOCK_PLACES.map((p) => [p.name, p.lat, p.lon, p.value]),
    },
  },
];

const DEFAULT_SETTINGS: Settings = {
  labelColumn: "city",
  latColumn: "latitude",
  lonColumn: "longitude",
  valueColumn: "validations",
};

function App() {
  const [dark, setDark] = useState(false);
  const [width, setWidth] = useState(700);
  const [height, setHeight] = useState(420);
  const [pointSize, setPointSize] = useState(7);
  const [colorHigh, setColorHigh] = useState("#509EE3");
  const [showLegend, setShowLegend] = useState(true);
  const [legendTitle, setLegendTitle] = useState("");

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    pointSize,
    colorLow: "#ebedf0",
    colorHigh,
    showLegend,
    legendTitle,
  };

  const labelStyle = { color: dark ? "#ccc" : "#333", display: "flex", alignItems: "center", gap: 4 };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24, background: dark ? "#111" : "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={labelStyle}>
          Width:&nbsp;<input type="number" value={width} onChange={e => setWidth(+e.target.value)} style={{ width: 70 }} />
        </label>
        <label style={labelStyle}>
          Height:&nbsp;<input type="number" value={height} onChange={e => setHeight(+e.target.value)} style={{ width: 70 }} />
        </label>
        <label style={labelStyle}>
          Point size:&nbsp;<input type="number" value={pointSize} onChange={e => setPointSize(+e.target.value)} style={{ width: 50 }} min={2} max={30} />
        </label>
        <label style={labelStyle}>
          High color:&nbsp;<input type="color" value={colorHigh} onChange={e => setColorHigh(e.target.value)} />
        </label>
        <label style={labelStyle}>
          <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} />&nbsp;Legend
        </label>
        <label style={labelStyle}>
          Legend title:&nbsp;<input type="text" value={legendTitle} onChange={e => setLegendTitle(e.target.value)} placeholder="optional…" style={{ width: 120 }} />
        </label>
        <label style={labelStyle}>
          <input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} />&nbsp;Dark
        </label>
      </div>

      <div style={{ width, height, border: `1px solid ${dark ? "#333" : "#ddd"}`, borderRadius: 8, overflow: "hidden" }}>
        <MapPoint
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          series={MOCK_SERIES as any}
          settings={settings}
          width={width}
          height={height}
          colorScheme={dark ? "dark" : "light"}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onClick={() => {}}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onHover={() => {}}
        />
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<StrictMode><App /></StrictMode>);
}
