# VayuAI

Neighbourhood-level pollution intelligence for Guwahati — built on citizen reports, social media signals and a lightweight NLP pipeline.

City-level air quality apps miss hyper-local pollution events: garbage dump fires, illegal waste burning, industrial smoke, construction dust, traffic smog. Municipal authorities can't watch every street, but residents post about these events the moment they happen. VayuAI taps into that signal, filters the noise, extracts what matters, and puts it on a live map.

---

## What it does

VayuAI monitors a social media feed and citizen reports, runs each post through a Named Entity Recognition pipeline, analyzes uploaded pollution photos with Gemini Vision when configured, and plots detected pollution events on an interactive map in real time. You get severity-colored markers across Guwahati's localities, a heatmap showing where pollution is clustering, and a timeline that lets you replay how a situation spread over time.

Citizen report / social post / photo → translation + Gemini Vision → NER pipeline → noise filter → geocoding → live map + alerts

The NER engine is rule-based and tuned specifically for pollution contexts. It extracts four things from each post: the locality, the pollution type, the severity, and any affected counts mentioned. A 5-signal relevancy engine filters sarcasm, throwbacks, promotions and figurative uses of "fire"/"smoke".

---

## Getting started

```bash
npm install

# Optional, enables real photo analysis
# GEMINI_API_KEY=your_key_here

# Terminal 1
npm run server

# Terminal 2
npm run dev
```

Open http://localhost:5173.

---

## Features

- _Live map_ — MapLibre GL map centered on Guwahati with severity-colored markers at locality level
- _Heatmap_ — density overlay that shows where pollution is concentrating
- _Live feed_ — SSE-powered stream that auto-scrolls as new reports come in; click any report to fly to its location on the map
- _Photo evidence_ — citizen uploads are resized in-browser and analyzed by Gemini Vision for smoke, dust, fire and dumping signals when `GEMINI_API_KEY` is configured
- _Timeline_ — playback controls so you can watch a pollution situation unfold over time
- _Filters_ — toggle between garbage burning, industrial emission, vehicle pollution, construction dust, illegal dumping, and smog events
- _Multilingual_ — Assamese/Hindi/Bengali reports are auto-translated before analysis; the UI keeps the original with a Translate toggle
- _Push notifications_ — browser alerts fire on critical-severity events
- _Simulation controls_ — play/pause and speed controls, useful for demos

---

## Architecture

```
VayuAI/
├── server/
│ ├── index.js # Express server + SSE streaming
│ ├── imageAnalysis.js # Gemini Vision image classifier
│ ├── nlpPipeline.js # NER engine — pollution classification + relevancy filter
│ ├── translator.js # Auto-translation for regional languages
│ ├── geocoder.js # 50+ Guwahati localities with lat/lng
│ ├── fakeData.js # ~110 realistic pollution reports for demo
│ └── eventStore.js # In-memory store with aggregations
└── src/
├── App.jsx
└── components/
├── LiveMap.jsx # MapLibre GL map + heatmap layer
├── LiveFeed.jsx # Real-time report sidebar
├── TimelinePanel.jsx # Trend playback
├── AlertBanner.jsx # Critical alert + push notifications
└── AddTweetModal.jsx # Citizen pollution report form
```

### NLP pipeline

The NER engine does keyword-based classification across 6 pollution categories (garbage burning, industrial emission, vehicle pollution, construction dust, illegal dumping, smog), matches locations against a hand-curated list of 50+ Guwahati localities — including the Boragaon landfill, the Noonmati refinery belt and the GS Road traffic corridor — assigns severity across 4 levels based on health-impact keywords, and uses regex to pull out affected-people counts when they appear.

A multi-signal relevancy engine (text quality, source credibility, cross-referencing, temporal coherence, engagement) separates genuine reports from noise like "this track is fire 🔥" or Diwali throwbacks.

---

## Stack

| Layer     | Tech                                   |
| --------- | -------------------------------------- |
| Frontend  | React 19 + Vite                        |
| Map       | MapLibre GL JS                         |
| Charts    | Recharts                               |
| Backend   | Express.js                             |
| Streaming | Server-Sent Events                     |
| NLP       | Custom rule-based NER + relevancy engine |
| Vision    | Gemini Vision via Google Generative Language API |

---

## Demo tips

- Turn on the _heatmap_ first — it immediately shows you where pollution is clustering
- Open the _timeline_ and hit play to watch events unfold chronologically
- Crank speed to _Fast (3s)_ if you're demoing live
- Click any report in the sidebar to jump the map to that location
- Submit a report like "huge garbage fire in Fancy Bazaar, can't breathe" or attach a pollution photo with a location and watch it appear on the map
- Wait for a critical event to trigger the alert banner + browser notification

See `PLAN.md` for the full hackathon roadmap and `PROGRESS.md` for phase-by-phase status.
