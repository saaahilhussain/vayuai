# VayuAI — Progress Tracker

Tracks execution of the roadmap in `PLAN.md` (Track 2: CleanAir & Clear Streets). Updated at every phase gate.

---

## Architecture summary

VayuAI is a real-time pollution intelligence platform built on the former HazardLens codebase. An Express 5 server ingests reports (simulated social feed + citizen submissions), translates regional-language text, classifies it with a rule-based NLP pipeline, analyzes uploaded pollution photos with Gemini Vision when configured, filters noise with a 5-signal relevancy engine, geocodes to Guwahati localities, stores events in an in-memory ring buffer, and streams them to a React 19 + Vite frontend over Server-Sent Events.

```
citizen report / social post
        │
        ▼
  translator.js + Gemini Vision (text/photo → structured pollution signals)
        │
        ▼
  nlpPipeline.js (pollution type + severity + locations + affected count)
        │
        ▼
  relevancy engine (text quality 35% · source 20% · cross-ref 20% · temporal 15% · engagement 10%)
        │  ── noise filtered out (manual reports bypass)
        ▼
  geocoder.js (50+ Guwahati localities, ±0.003° jitter)
        │
        ▼
  EventStore (in-memory, 500 cap) ──► SSE stream + REST API
        │
        ▼
  React UI: LiveMap (MapLibre + heatmap) · LiveFeed · TimelinePanel · AlertBanner · Report modal
```

---

## Phase tracking

| Phase | PLAN.md goal | Status | Verified how |
|---|---|---|---|
| 1. Understand repository | Architecture map, identify flood-specific vs reusable modules | ✅ Done | Full codebase exploration; this document |
| 2. Flood → Pollution conversion | Pollution taxonomy, Guwahati geocoder, demo data, rebrand, working deterministic pipeline | ✅ Done | Server seeds pollution events; `/api/stats` shows 6 pollution types; manual report test; grep clean of flood/disaster refs |
| 3. Image-based detection (Gemini Vision) | Photo upload + AI smoke/dust/fire classification | ✅ Done | Upload UI, server image classifier, Gemini confidence shown in feed/map; gracefully reports unavailable analysis when key/config fails |
| 4. Multi-source fusion | Virtual AQI sensors, duplicate merging, confidence aggregation | ✅ Done | 12 virtual sensors on map; `/api/sensors` returns live readings; duplicate events merge with corroboration count; fusedConfidence shown in feed/popup; sensor pressure feedback loop |
| 5. Hotspot detection | Spatial clustering, ranked hotspots, hotspot map layer | ✅ Done | `HotspotEngine` uses 500m grid clustering; UI has pulsing radar overlays and sortable side panel |
| 6. 24h prediction | Explainable AQI forecast (trend + diurnal + event pressure) | ✅ Done | `/api/predictions` endpoint; live Forecast panel with sparklines & explainability tags; map forecast overlays |
| 7. Municipal intelligence | Intervention recommendations + AI action brief | ✅ Done | `MunicipalEngine` uses Gemini to generate dispatch directives; live Command Center UI in map |
| 8. Video Analysis | Video upload + Frame extraction + Gemini Vision aggregation | ✅ Done | Client-side HTML5 `<video>` extraction; server sends sequential frames to Gemini for holistic incident assessment |
| 9. Accessibility | Voice reporting, multilingual UI | ⏸ Deferred — future work. Note: incoming regional-language reports are already auto-translated (partial Inclusivity coverage today) |
| 10. Government data | Live CPCB / IMD integration | ✅ Done | Replaced virtual sensor grid with real CPCB data from OpenAQ for Guwahati; IMD weather proxy via Open-Meteo |
| 11. Demo & presentation | Demo script, docs, seed tuning | ⬜ Not started | — |

## Phase 2 change log

- `server/nlpPipeline.js` — 6-category pollution taxonomy (garbage_burning, industrial_smoke, vehicle_pollution, construction_dust, garbage_dumping, smog) with Assamese/Hindi/Bengali transliterations; health-impact severity keywords; Guwahati locality NER list; pollution-agency trust sources (PCB Assam, CPCB, GMC, GMDA); figurative-language noise traps ("track is fire", BBQ, hookah); fields renamed `isPollution`/`pollutionType`
- `server/geocoder.js` — 50 real Guwahati localities incl. Boragaon dumpsite, Noonmati refinery, Pandu port, GS Road corridor; zone centroids; jitter ±0.02° → ±0.003° for city zoom
- `server/fakeData.js` — ~110 pollution report templates (incl. 8 romanized + 6 full-script regional-language) anchored on recurring narratives (Boragaon dump fires, Noonmati plumes, GS Road smog, Six Mile dust); 30 noise decoys; new handles/profiles
- `server/index.js`, `server/eventStore.js` — event schema `pollutionType`, trend buckets = 6 pollution types, rebranded logs
- Frontend — `POLLUTION_TYPES` config; map re-centered to Guwahati (z12, city bounds); TimelinePanel sums derived from config (no hardcoding); VayuAI branding in Navbar/AlertBanner/index.html/README; pollution report placeholder in modal
- `package.json` — name `airlens`; fixed `--watch` flag placement; `--env-file-if-exists=.env` so `GEMINI_API_KEY` will load in Phase 3
- `public/images/` — flood photos replaced by CC pollution photos (garbage-dump smoke, demolition dust, city smog) from Wikimedia Commons

---

## Judging criteria mapping

| Criterion | Weight | Covered by | Status |
|---|---|---|---|
| Problem-Solution Fit | 20% | Phase 2 (hyper-local reports → map), Phase 5 (hotspots), Phase 7 (municipal actions) | 🟡 Partial — core reporting loop works, hotspots live; actions pending |
| AI / Technical Execution | 25% | Phase 2 (NLP + relevancy engine), Phase 3 (Gemini Vision), Phase 6 (forecast), Phase 7 (AI briefs) | 🟡 Partial — deterministic NLP pipeline and Gemini photo classification live; forecast/AI briefs pending |
| Deployability & Scalability | 25% | Express + SSE architecture, production build served by server, config-driven taxonomy | 🟡 Partial — runs end-to-end locally; docs/demo hardening in Phase 10 |
| Inclusivity & Accessibility | 15% | Auto-translation of Assamese/Hindi/Bengali reports (live now), Phase 8 (voice/UI languages — deferred) | 🟡 Partial |
| Impact Potential | 10% | Earlier detection via citizen signal (live), targeted interventions (Phase 7) | 🟡 Partial |
| Presentation & Clarity | 5% | Phase 10 demo script + README/ARCHITECTURE rewrite | ⬜ Pending |

---

## Next up (awaiting confirmation)

**Phase 11 — Demo & presentation.**

## Phase 8 change log

- `src/components/AddTweetModal.jsx` — Added `video/*` support. Uses `<video>` and `<canvas>` to seek and extract up to 10 frames locally (every 2s). Sends `videoFrames` array to backend.
- `src/utils/api.js` — Added `videoFrames` to `postCustomTweet` payload.
- `server/imageAnalysis.js` — Added `analyzeVideoFrames` which receives array of base64 images and feeds them all to Gemini using `inline_data` objects for sequential, holistic assessment.
- `server/index.js` — Modified `processTweetDetailed` to route requests with `videoFrames` to the new video analysis engine.

## Phase 7 change log

- `server/municipalEngine.js` [NEW] — Generates actionable municipal interventions using the Gemini API based on hotspots, predictions, and weather data. Includes a robust fallback mechanism if the API key is missing.
- `server/index.js` — Added `GET /api/municipal-brief` endpoint with a 5-minute cache to prevent Gemini rate limiting.
- `src/components/MunicipalPanel.jsx` & `.css` [NEW] — Built the "Command Center" UI to display prioritized AI action briefs with dispatch controls.
- `src/App.jsx` — Added `municipalActive` state and a highlighted "Command Center" toggle button in the map control bar.

## Phase 6 change log

- `server/predictionEngine.js` [NEW] — Generates 24-hour predictions for all sensors combining diurnal multipliers, historical event trends (48h), weather stagnation/dispersal, and active hotspot pressure. Emphasizes explainability over black-box ML.
- `server/index.js` — added `GET /api/predictions` endpoint.
- `src/components/PredictionPanel.jsx` [NEW] — Floating panel listing sensor locations with their predicted peak AQI, 24h sparklines, and explainable AI factors (e.g., "Wind Stagnation", "Escalating Trend").
- `src/components/PredictionPanel.css` [NEW] — Styles for the prediction panel, sparklines, and impact chips.
- `src/components/LiveMap.jsx` & `LiveMap.css` — Added pulsing forecast overlays (dashed rings with current → peak AQI values) for sensors.
- `src/App.jsx` — Added `predictionsActive` state and "Forecast" toggle button in the control bar. Polls predictions every 60s.

## Phase 5 change log

- `server/hotspotEngine.js` [NEW] — grid-based spatial clustering (500m cells); computes centroid, composite severity score (incorporating NLP confidence and nearest sensor AQI), and ranks hotspots worst-first
- `server/index.js` — added `GET /api/hotspots` endpoint
- `src/components/HotspotPanel.jsx` [NEW] — floating UI panel listing ranked hotspots with scores, event counts, and sensor data; click-to-pan functionality
- `src/components/LiveMap.jsx` — added pulsing radar overlays for hotspots scaled by severity and radius
- `src/App.jsx` — added `hotspotsActive` state and toggle button; polls `/api/hotspots` every 15s

## Phase 4 change log

- `server/sensorGrid.js` [NEW] — 12 virtual AQI sensors across Guwahati (Boragaon, Noonmati, Pandu, GS Road, Six Mile, Fancy Bazaar, Ganeshguri, Bamunimaidan, Khanapara, Dispur, Jalukbari, Beltola); diurnal AQI variation (morning/evening rush peaks); report-pressure feedback (citizen reports within 2 km temporarily boost nearby sensor AQI); sliding window of readings (2 hours); Indian NAQI-standard AQI category/color mapping
- `server/eventStore.js` — duplicate detection via haversine proximity (<0.5 km) + pollution type match + token-overlap text similarity (>0.35); `mergeInto()` increments `corroborationCount`, upgrades severity, recalculates confidence, tracks `corroboratedBy` handles; `duplicatesMerged` counter in stats
- `server/index.js` — sensor corroboration: nearest sensor AQI >150 adds `sensorCorroboration` object to events; `fusedConfidence` computed from NLP (35%) + image (30%) + sensor (20%) + base confidence (15%); `GET /api/sensors` endpoint; all event paths (seed, simulation, manual, batch) register reports with sensor grid for pressure feedback
- `src/utils/api.js` — `fetchSensors()` helper
- `src/components/LiveMap.jsx` — `sensorsActive` prop; fetches sensor data every 30s; renders AQI-colored circle markers with value labels on map; fused confidence, corroboration count, and sensor AQI badges in popup InfoWindow
- `src/components/LiveFeed.jsx` — fused confidence percentage, corroboration source count, and sensor AQI shown in feed item meta row
- `src/components/LiveFeed.css` — styles for `.feed-item-fused`, `.feed-item-corroboration`, `.feed-item-sensor`
- `src/components/LiveMap.css` — styles for `.sensor-marker`, `.mtp-fusion`, `.mtp-fused-badge`, `.mtp-corr-badge`, `.mtp-sensor-badge`
## Phase 9a change log (Public Government Data)

- `server/sensorGrid.js` — replaced simulated sensor math with a live API fetch to OpenAQ (`https://api.openaq.org/v2/latest?city=Guwahati`); maps real CPCB station data (Panbazar, Railway Station, IIT, Airport) to the grid; automatically converts PM2.5 readings to Indian NAQI standard; retains simulated fallback sensors (e.g. Boragaon Landfill) to ensure city-wide heatmap coverage during demo
- `server/weatherService.js` [NEW] — fetches live wind speed, wind direction, and temperature from Open-Meteo for Guwahati as a proxy for IMD data; cached for 30 minutes
- `server/index.js` — added `GET /api/weather` endpoint to serve IMD-proxy weather data to the frontend (preparing for Phase 6 Prediction)
## Phase 3 change log

- `server/imageAnalysis.js` — Gemini Vision classifier for uploaded image data URLs; normalizes pollution type, severity, confidence, visible signals, summary and recommended report text; degrades gracefully when `GEMINI_API_KEY` is missing or Gemini errors
- `server/index.js` — manual reports now accept text, photo, or both; image evidence can validate pollution even when text is sparse; accepted events include `imageMeta` and `imageAnalysis`; rejection reasons distinguish no signal, unavailable image analysis and unknown Guwahati location
- `src/components/AddTweetModal.jsx` — citizen report form supports optional photo upload, browser-side resize to JPEG, preview/removal, and Gemini-aware submit status; text-only and photo-only submissions are both supported
- `src/components/LiveFeed.jsx`, `src/components/LiveMap.jsx` — Gemini confidence and image-analysis summaries appear in the live feed and map popups; popup report fields are escaped before HTML rendering
- `README.md` — setup and feature documentation now describe the Gemini photo-analysis path
