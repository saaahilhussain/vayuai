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
| 4. Multi-source fusion | Virtual AQI sensors, duplicate merging, confidence aggregation | ⬜ Not started | — |
| 5. Hotspot detection | Spatial clustering, ranked hotspots, hotspot map layer | ⬜ Not started | — |
| 6. 24h prediction | Explainable AQI forecast (trend + diurnal + event pressure) | ⬜ Not started | — |
| 7. Municipal intelligence | Intervention recommendations + AI action brief | ⬜ Not started | — |
| 8. Accessibility | Voice reporting, multilingual UI | ⏸ Deferred — future work. Note: incoming regional-language reports are already auto-translated (partial Inclusivity coverage today) |
| 9. Government data | Live CPCB / IMD integration | ⏸ Deferred — future work (demo uses simulated sensors) |
| 10. Demo & presentation | Demo script, docs, seed tuning | ⬜ Not started | — |

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
| Problem-Solution Fit | 20% | Phase 2 (hyper-local reports → map), Phase 5 (hotspots), Phase 7 (municipal actions) | 🟡 Partial — core reporting loop works; hotspots/actions pending |
| AI / Technical Execution | 25% | Phase 2 (NLP + relevancy engine), Phase 3 (Gemini Vision), Phase 6 (forecast), Phase 7 (AI briefs) | 🟡 Partial — deterministic NLP pipeline and Gemini photo classification live; forecast/AI briefs pending |
| Deployability & Scalability | 25% | Express + SSE architecture, production build served by server, config-driven taxonomy | 🟡 Partial — runs end-to-end locally; docs/demo hardening in Phase 10 |
| Inclusivity & Accessibility | 15% | Auto-translation of Assamese/Hindi/Bengali reports (live now), Phase 8 (voice/UI languages — deferred) | 🟡 Partial |
| Impact Potential | 10% | Earlier detection via citizen signal (live), targeted interventions (Phase 7) | 🟡 Partial |
| Presentation & Clarity | 5% | Phase 10 demo script + README/ARCHITECTURE rewrite | ⬜ Pending |

---

## Next up (awaiting confirmation)

**Phase 4 — Multi-source fusion.** Next target: add virtual AQI sensors, duplicate merging and confidence aggregation so text reports, image reports and sensor readings roll up into unified pollution events.
## Phase 3 change log

- `server/imageAnalysis.js` — Gemini Vision classifier for uploaded image data URLs; normalizes pollution type, severity, confidence, visible signals, summary and recommended report text; degrades gracefully when `GEMINI_API_KEY` is missing or Gemini errors
- `server/index.js` — manual reports now accept text, photo, or both; image evidence can validate pollution even when text is sparse; accepted events include `imageMeta` and `imageAnalysis`; rejection reasons distinguish no signal, unavailable image analysis and unknown Guwahati location
- `src/components/AddTweetModal.jsx` — citizen report form supports optional photo upload, browser-side resize to JPEG, preview/removal, and Gemini-aware submit status; text-only and photo-only submissions are both supported
- `src/components/LiveFeed.jsx`, `src/components/LiveMap.jsx` — Gemini confidence and image-analysis summaries appear in the live feed and map popups; popup report fields are escaped before HTML rendering
- `README.md` — setup and feature documentation now describe the Gemini photo-analysis path
