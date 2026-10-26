# Groundshift

An interactive satellite archive explorer with area selection and two-date comparison, plus a reviewed Las Vegas case study. Built for Hacktoberfest 2026.

## Run

Install Node.js 22 or newer, then:

```sh
npm start
```

Open http://localhost:3000. There are no package dependencies or build steps. Alternatively: `node --env-file-if-exists=.env server.mjs`.

## Features

- Two bundled NASA satellite images with a keyboard-accessible comparison slider.
- Three selectable, manually reviewed regions and before/after close-ups.
- Evidence-based text answers, map selection, and comparison export.
- Before/after mode, annotation toggle, sources dialog, and Markdown field-note export.
- Responsive layout, visible focus states, accessible labels, and request error handling.

## Evidence and limitations

Source: [NASA Earth Observatory — 25 Years of Growth in Las Vegas](https://science.nasa.gov/earth/earth-observatory/25-years-of-growth-in-las-vegas-37228/).
Images by Jesse Allen and Robert Simmon, based on Landsat 5 data from USGS. Approximately 30 m sensor resolution. Original acquisition dates are preserved. Bundled JPEGs share the same image extent and dimensions; both render through identical geometry. No further geospatial registration was performed.

Regions in `public/data.js` were visually reviewed during development and are **illustrative areas of interest**, not measured change polygons. This is not automatic change detection. Text responses are deterministic retrieval from the curated notes, not model-generated image analysis. No quantified land-cover loss, area ranking, construction causes, or individual building classification is claimed. Seasonal differences (October versus January) limit vegetation comparisons.


## Development

```sh
npm run dev
npm test
```

- `public/index.html`, `public/style.css`: interface.
- `public/app.js`: comparison, region selection, text questions, and export.
- `public/data.js`: evidence records and grounded question routing.
- `server.mjs`: static server and `/api/ask`.
- `test/evidence.test.mjs`: evidence-routing and uncertainty checks.

The server binds to loopback for local development. Add authentication and rate limits before exposing paid API endpoints publicly. Static serving is restricted to `public/` so `.env` and repository files are inaccessible.

## Team workflow

Commit and push these files to your shared Git repository. Teammates clone/pull, install Node 22+, and run `npm start`. Keep local settings in each developer's ignored `.env` file.



## Live archive explorer

The home page now searches **USGS Landsat Collection 2 Level-2** through Microsoft Planetary Computer. The collection starts **1982-08-22**, covers Landsat 4–9, and continues to receive newer scenes. A live catalogue query verified a Bay Area acquisition on **2026-10-13** during implementation; the header queries the latest intersecting pass instead of hard-coding that date.

1. Pan and zoom anywhere in the United States, or jump to one of the 50 states using the navigation menu. Click **Draw area**, then drag a box and release to select it. **Use map view** selects the entire visible extent as an alternative. Alaska, Hawaii, DC, and Puerto Rico are available in the navigation menu.
2. Choose two target dates. Search finds acquisitions within **±45 days** of each target, sorted by distance from the requested day, then cloud cover.
3. Choose actual acquisitions from the two menus. Their real dates, sensor, scene-wide cloud cover, date offsets, and original metadata links are shown.
4. Compare using the swipe handle or side-by-side mode. Download the comparison notes to preserve bounds and scene IDs.

Only scene metadata and two cropped natural-color images load. There is no full-year archive download and no API key for imagery. A bounded, 10-minute in-memory metadata cache reduces repeated requests. Queries cover at most four pages of 100 candidates; the closest 40 qualifying scenes are listed and result truncation is disclosed. Footprint filtering requires the rectangle's corners and center to lie within a scene polygon. This is a conservative footprint check, not a guarantee of valid or cloud-free pixels throughout the crop.

Limits: 0.01°–2° per coordinate axis; latitude ±80°. Rendering is capped at 1,024 pixels on the longest side. Both dates use identical geographic bounds, output dimensions, CRS, and color formula. Native source resolution is approximately 30 m, but a large selected area may be displayed more coarsely. No additional scientific co-registration or cross-sensor normalization is performed. Local cloud/fog, seasons, missing pixels, and Landsat 7 scan-line gaps can affect comparisons. A specific calendar date, or every year at every location, is not guaranteed to have a usable scene.

The main comparison viewer has no chat section. Source information, flight dates, and interpretation cautions are shown directly with the images. The original reviewed example remains at `/demo.html`.

New files: `archive.mjs` (catalogue/validation/render URLs), `public/explorer.js`, `public/explorer.css`, and `test/archive.test.mjs`. Leaflet 1.9.4 is vendored in `public/vendor/leaflet/`; map tiles use OpenStreetMap with visible attribution.

Sources:
- https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2
- https://planetarycomputer.microsoft.com/api/stac/v1/collections/landsat-c2-l2
- https://planetarycomputer.microsoft.com/api/data/v1/docs
- https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products
- https://leafletjs.com/reference.html

## Nationwide coverage

The main explorer supports **Draw area** for drag-to-select rectangles and **Use map view** for the full visible extent. Bay Area presets and manual coordinate selection were removed. Start at the US overview, choose a state to navigate quickly, then pan/zoom to a local area. The selection button enables when the visible extent is within the 0.01°–2° rendering limits. Moving the map does not silently replace the committed comparison; draw a new box or click Use map view to choose another extent.

The same public Landsat catalogue is searched nationwide, with no California/Bay Area filter. `public/us-regions.js` contains approximate centers for navigation, not satellite-data boundaries. Local views can be selected throughout the contiguous states, Alaska, and Hawaii. For views crossing the date line, pan to one side before selecting.

`docs/us-coverage.json` records live metadata checks for a representative location in each of the 50 states over 2025. All 50 returned scenes. This is representative availability evidence; it does not guarantee every pixel, year, or requested date is cloud-free. Additional live crop-render checks were performed for New York, Alaska, and Hawaii.

Searches always include only scenes with **less than 20% cloud cover**. The selector has been removed; the server enforces this fixed rule in both its catalogue query and returned results. Scenes with exactly 20%, higher values, or unknown cloud cover are excluded. This is the whole-scene cloud estimate, not a measurement specific to the selected crop.

Rectangle drawing uses mouse, pen, or touch pointer capture, previews the area dimensions, and preserves the existing selection when cancelled with Escape. A single accidental click cannot replace the selection.

## Higher-resolution recent imagery

For target dates on or after **2015-06-27**, searches now prefer **Copernicus Sentinel-2 L2A** with native **10 m true-color imagery**. Earlier dates use **30 m Landsat**. If no qualifying Sentinel-2 scene covers the complete selected area in the ±45-day window, the app explicitly discloses a Landsat fallback. Every displayed scene still has strictly less than 20% reported cloud cover. Resolution and collection are stored per scene and displayed in the pass menus and evidence cards. Comparisons across sensors include an interpretation note.

Render output is capped at **2,048 pixels** per side rather than 1,024, reducing display downsampling for larger views. This does not add detail beyond the original sensor. Smaller drawn selections show more of the native detail. The default earlier date is now September 2018 so a fresh comparison can use the higher-resolution archive on both sides.

Sources:
- https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2
- https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a
- https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a

NAIP aerial imagery is now preferred where available, with annual flight dates and the product cloud specification disclosed separately from measured satellite cloud percentages.

## High-detail historical aerial imagery

The viewer now prefers annual NAIP aerial photography before satellite fallbacks. It checks the official California CDFW archive (including 2009) and the Planetary Computer national NAIP catalogue (2010–2023, variable availability). California service years are discovered dynamically. Only the explicitly requested year is used. Original tile filenames preserve acquisition dates, and original raster IDs are locked for mosaic rendering. National quarter-quad tiles are composited at identical bounds and output dimensions, with up to 16 intersecting tiles; broader selections can fall back to satellite imagery.

A live Mountain View check at bounds `[-122.10,37.37,-122.06,37.41]` verified **1 m 2009 imagery**, acquired **June 8–19, 2009**. A 2020 comparison found **0.6 m NAIP imagery**, acquired **May 25, 2020**. Acquisition ranges are displayed when a mosaic contains multiple flight dates. Native detail is limited by image resolution and the selected display extent.

Cloud provenance differs: satellite scenes must report cloud cover strictly below 20%; NAIP products follow the USGS-described specification of at most 10% cloud cover per tile. NAIP does not provide a measured percentage in these metadata. The interface explicitly labels the product-standard basis and never fabricates a numeric cloud estimate. This replaces the earlier behavior that excluded NAIP for missing measured cloud metadata.

No source supplies clear high-resolution imagery for every historical day or year. Missing aerial coverage is disclosed, with 10 m Sentinel-2 or 30 m Landsat as labeled fallbacks. A larger export of a coarse satellite image does not create historical detail.

Sources:
- https://gis.wildlife.ca.gov/images/rest/services/Base_Remote_Sensing/NAIP_2009/ImageServer
- https://wildlife.ca.gov/Data/GIS/Map-Services
- https://www.usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-national-agriculture-imagery-program-naip
- https://planetarycomputer.microsoft.com/api/stac/v1/collections/naip

## Matched display colors

Comparisons default to **Match colors**. Both dates are composited at full render resolution, then balanced symmetrically using per-channel median brightness and the 10th–90th percentile range from overlapping valid pixels. Transparent/no-data and near-white cloud pixels are excluded from the sample. Gain and shift are bounded to avoid extreme changes. This preserves image geometry and alpha while reducing exposure and color-cast differences. It does not add detail or perform scientific radiometric calibration, and it can reduce real color differences.

Click the color control to switch to **Original colors**. Original source pixels remain unchanged and are restored immediately. If insufficient valid overlap is available, original colors are shown with an explanation. Prefer originals for interpreting vegetation, water color, or reflectance.

The local `/api/image` route relays only the existing public Planetary Computer crop endpoint and official California NAIP export endpoints, with HTTPS, restricted hosts and paths, no credentials or redirects, an image-content check, and a 25 MB response limit. This allows pixel rendering without cross-origin canvas restrictions.

## Published app

Groundshift is published at [groundshift-earth.honeyclock5.chatgpt.site](https://groundshift-earth.honeyclock5.chatgpt.site), with access for anyone who has the link.

The hosting source is in `sites/groundshift/`. It preserves the same interface and imagery logic, with Worker-compatible API routes for catalogue searches, image streaming, and the metadata guide. The original project remains the local development app. Synchronize future changes into the hosting source before republishing through the Sites workflow.

## Sharper aerial sources

The comparison chat has been removed. The viewer now checks USDA’s current NAIP service and USGS The National Map alongside California and Planetary Computer archives, preferring finer native pixel sizes from the exact requested calendar year. It never substitutes a current basemap or a different year. Original capture dates, source links, and native resolution remain visible.

USDA live checks found Mountain View imagery captured May 20–29, 2024 at 0.6 m and Helena imagery captured September 5, 2025 at 0.3 m. These are aerial photographs, not higher-resolution satellite observations. Availability still varies by location and year.

Aerial exports now follow the native pixel size up to 4,000 pixels per side for official mosaic services, with JPEG quality 95. Planetary Computer mosaics retain transparent PNG tiles up to 3,072 pixels. Satellite output remains capped at 2,048 pixels. Large extents can still downsample the source; the displayed metadata identifies that when applicable.

Sources: [USDA current NAIP service](https://apps.geo.fpac.usda.gov/geo-imagery/rest/services/naip/conus_naip/ImageServer), [USGS NAIP](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer), [USDA NAIP description](https://catalog.data.gov/dataset/national-agriculture-imagery-program-naip-imagery).
