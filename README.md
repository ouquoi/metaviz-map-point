# Map Point

A geolocated point map for Metabase. Each row becomes a circle on an interactive OSM-tiled map, colored by value intensity. Supports zoom, pan, and hover tooltips.

## Requirements

- Metabase **≥ 1.62.0**

## Installation

1. Download `map-point-X.Y.Z.tgz` from the [latest release](https://github.com/ouquoi/metaviz-map-point/releases/latest)
2. In Metabase, go to **Admin → Visualizations**
3. Click **Add a visualization**
4. Upload the `.tgz` file

## Usage

### Query

Your question must return a label column, a latitude column, a longitude column, and optionally a numeric value column.

```sql
SELECT city, latitude, longitude, COUNT(*) AS validations
FROM places
GROUP BY 1, 2, 3
ORDER BY 4 DESC
```

### Settings

#### Data

| Setting | Description | Default |
|---------|-------------|---------|
| Label column | Text column shown in tooltip and used for drill-through | First text column |
| Latitude column | Numeric column (decimal degrees, −90 to 90) | First column matching `lat` |
| Longitude column | Numeric column (decimal degrees, −180 to 180) | First column matching `lon`/`lng` |
| Value column (color) | Numeric column used for color intensity | First numeric not matching lat/lon |

#### Appearance

| Setting | Description | Default |
|---------|-------------|---------|
| Point size | Circle radius in pixels | `7` |
| Color — low values | Color for the lowest values | `#ebedf0` |
| Color — high values | Color for the highest values | `#509EE3` |
| Show map tiles | Display OpenStreetMap background tiles | `true` |
| Show legend | Display the color scale legend below the map | `true` |
| Legend title | Optional label displayed above the legend | *(empty)* |

## Capabilities

| Feature | Details |
|---------|---------|
| Base map | OpenStreetMap tiles (HTML `<img>`, sandbox-safe) |
| Zoom | Scroll wheel (centered on cursor) · +/− buttons · pinch-to-zoom on mobile |
| Pan | Mouse drag · touch drag |
| Auto-fit | Map auto-zooms and centers on data bounds at load |
| Color scale | Linear gradient from low to high value |
| Color legend | Gradient bar with min / mid / max values |
| Hover tooltip | Structured card with colored strip, label, metric name + value; arrow pointing to pin; smart positioning (flips to avoid edges) |
| Drill-through | Click a point to filter by label |
| Dark mode | Full dark theme support |
| Responsive | Adapts to any card size |
| Missing coords | Rows with null or out-of-range coordinates are ignored |

## Data requirements

| Column | Type | Notes |
|--------|------|-------|
| Label | Text | Used for tooltip and drill-through |
| Latitude | Float | Decimal degrees, must be in −90…90 |
| Longitude | Float | Decimal degrees, must be in −180…180 |
| Value | Numeric | Optional — if absent, points render with a single color |

## Development

```bash
cd map-point
npm install
npm run dev          # watch mode — connect Metabase dev server to http://localhost:5174
npm run preview:viz  # standalone preview at http://localhost:5178
npm run build        # compile + generate .tgz
```

## License

MIT
