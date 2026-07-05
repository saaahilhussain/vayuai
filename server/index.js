// VayuAI Express Server — REST API + SSE for real-time streaming

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { processText } from "./nlpPipeline.js";
import { translateText } from "./translator.js";
import {
  geocodeBest,
  
  isWithinGuwahatiBounds,
  jitter,
  nearestLocation,
  LOCATIONS,
} from "./geocoder.js";
import { generateTweet, generateHistoricalBatch } from "./fakeData.js";
import { EventStore } from "./eventStore.js";
import { analyzePollutionImage, generateReportDescription } from "./imageAnalysis.js";
import { SensorGrid } from "./sensorGrid.js";
import { getCurrentWeather } from "./weatherService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "8mb" }));

const store = new EventStore(500);
const sensorGrid = new SensorGrid();
const sseClients = [];

const TARGET_IMAGE_TYPES = new Set([
  "garbage_burning",
  "industrial_smoke",
  "construction_dust",
  "garbage_dumping",
  "smog",
]);

const TYPE_COMPATIBILITY = {
  garbage_burning: new Set(["garbage_burning", "garbage_dumping"]),
  garbage_dumping: new Set(["garbage_dumping", "garbage_burning"]),
  industrial_smoke: new Set(["industrial_smoke", "smog"]),
  construction_dust: new Set(["construction_dust"]),
  smog: new Set(["smog", "industrial_smoke"]),
};

const UNRELATED_REPORT_PATTERNS = [
  /\b(flood|flooding|waterlog|waterlogging|drain overflow|rainwater|standing water)\b/i,
  /\b(accident|crash|collision|injury|ambulance)\b/i,
  /\b(power cut|electricity|street light|pothole|road damage|traffic signal)\b/i,
  /\b(theft|crime|fight|protest|noise complaint)\b/i,
];

// --- SSE Setup ---
function broadcastEvent(event) {
  sseClients.forEach((res) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
}

app.get("/api/events/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  sseClients.push(res);
  req.on("close", () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

function analysisUnavailableReason(imageAnalysis) {
  if (!imageAnalysis || imageAnalysis.available) return null;
  if (imageAnalysis.error?.includes("GEMINI_API_KEY")) {
    return "Gemini image analysis is not configured on the server";
  }
  return imageAnalysis.error || "Image analysis is unavailable";
}

function normalizeCoords(coords) {
  if (!coords || typeof coords !== "object") return null;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isWithinGuwahatiBounds(lat, lng)) return null;
  return { lat, lng };
}

function isCompatiblePollutionType(textType, imageType) {
  if (!textType || textType === "other") return true;
  return TYPE_COMPATIBILITY[imageType]?.has(textType) || false;
}

function validateManualImageReport({ text, nlp, imageAnalysis }) {
  if (!imageAnalysis) return null;
  if (!imageAnalysis.available) return analysisUnavailableReason(imageAnalysis);

  if (
    !imageAnalysis.isPollution ||
    !TARGET_IMAGE_TYPES.has(imageAnalysis.pollutionType) ||
    imageAnalysis.confidence < 0.72
  ) {
    return "The uploaded image does not clearly show garbage burning, waste dumping, industrial smoke, construction dust, or smog. Please upload a relevant photo.";
  }

  const meaningfulText = typeof text === "string" && text.trim().length >= 12;
  if (!meaningfulText) return null;

  if (imageAnalysis.textImageMatch === false) {
    return "The image is correct, but your description does not match it. Please rewrite it to describe the visible pollution, or use the ✨ AI Write button to generate one.";
  }

  if (
    nlp.isPollution &&
    !isCompatiblePollutionType(nlp.pollutionType, imageAnalysis.pollutionType)
  ) {
    return "The report description and uploaded image describe different pollution types. Please make the text and photo refer to the same incident.";
  }

  if (
    !nlp.isPollution &&
    UNRELATED_REPORT_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return "The report description and uploaded image do not appear related. Please upload relevant data that describes the same incident.";
  }

  return null;
}

// --- Process a raw tweet into a structured event ---
async function processTweetDetailed(tweet) {
  // Get corroboration data from store (recent events from same location)
  const hintLoc = tweet.hintLocations?.[0] || "";
  const recentLocationEvents = store.getRecentByLocation(hintLoc);

  // Translate text for NLP
  const { translatedText, detectedLanguage } = await translateText(tweet.text);
  const isTranslated =
    detectedLanguage !== "en" &&
    translatedText.toLowerCase() !== tweet.text.toLowerCase();

  const nlp = processText(translatedText, {
    engagement: tweet.engagement || {},
    handle: tweet.handle || "",
    accountMeta: tweet.accountMeta || {},
    recentLocationEvents,
    hintLocations: tweet.hintLocations || [],
  });

  const imageAnalysis = tweet.imageDataUrl
    ? await analyzePollutionImage(tweet.imageDataUrl, {
        text: translatedText,
        location: tweet.hintLocations?.[0] || "",
        capturedAt: tweet.imageMeta?.capturedAt || null,
      })
    : null;

  const hasVisionPollution =
    imageAnalysis?.available &&
    imageAnalysis.isPollution &&
    TARGET_IMAGE_TYPES.has(imageAnalysis.pollutionType) &&
    imageAnalysis.confidence >= (tweet.source === "manual" ? 0.72 : 0.45);

  if (tweet.source === "manual" && imageAnalysis) {
    const rejectionReason = validateManualImageReport({
      text: translatedText,
      nlp,
      imageAnalysis,
    });
    if (rejectionReason) {
      return {
        event: null,
        reason: rejectionReason,
        nlp,
        imageAnalysis,
      };
    }
  }

  if (!nlp.isPollution && !hasVisionPollution) {
    return {
      event: null,
      reason:
        analysisUnavailableReason(imageAnalysis) ||
        "No pollution indicators detected in text or image",
      nlp,
      imageAnalysis,
    };
  }

  // Check relevancy — filter noise (skip for manual citizen reports)
  if (!nlp.isRelevant && tweet.source !== "manual") {
    store.incrementNoiseFiltered();
    console.log(
      `🚫 Filtered noise (relevancy: ${nlp.relevancyScore}): "${tweet.text.substring(0, 60)}..."`,
    );
    return {
      event: null,
      reason: "Filtered as noise (relevancy too low)",
      nlp,
      imageAnalysis,
    };
  }

  const submittedCoords = normalizeCoords(tweet.locationCoords);
  const geo = submittedCoords
    ? nearestLocation(submittedCoords.lat, submittedCoords.lng)
    : geocodeBest(
        nlp.locations.length > 0 ? nlp.locations : tweet.hintLocations || [],
      );
  if (!geo) {
    return {
      event: null,
      reason: "Please choose a Guwahati location or pin the report on the map.",
      nlp,
      imageAnalysis,
    };
  }

  const severityLevel = Math.max(
    nlp.severityLevel || 1,
    hasVisionPollution ? imageAnalysis.severityLevel || 1 : 1,
  );
  const severity =
    severityLevel >= 4
      ? "critical"
      : severityLevel === 3
        ? "high"
        : severityLevel === 2
          ? "moderate"
          : "low";
  const pollutionType =
    nlp.isPollution && nlp.pollutionType !== "other"
      ? nlp.pollutionType
      : imageAnalysis?.pollutionType || nlp.pollutionType;
  const confidence = Math.max(
    nlp.confidence || 0,
    hasVisionPollution ? imageAnalysis.confidence || 0 : 0,
  );

  // --- Sensor corroboration ---
  const eventLat = submittedCoords ? submittedCoords.lat : jitter(geo.lat);
  const eventLng = submittedCoords ? submittedCoords.lng : jitter(geo.lng);
  const nearestSensor = sensorGrid.getNearestSensor(eventLat, eventLng);
  let sensorCorroboration = null;
  if (nearestSensor && nearestSensor.distanceKm <= 3.0) {
    sensorCorroboration = {
      sensorId: nearestSensor.id,
      sensorName: nearestSensor.name,
      aqi: nearestSensor.aqi,
      category: nearestSensor.category,
      distanceKm: nearestSensor.distanceKm,
      corroborates: nearestSensor.aqi > 150,
    };
  }

  // --- Fused confidence ---
  const nlpConf = nlp.confidence || 0;
  const imgConf = hasVisionPollution ? (imageAnalysis.confidence || 0) : 0;
  const sensorConf = sensorCorroboration?.corroborates ? Math.min(1.0, nearestSensor.aqi / 400) : 0;
  // Corroboration signal will be added by EventStore.add() during merge
  const fusedConfidence = Math.min(
    1.0,
    nlpConf * 0.35 + imgConf * 0.30 + sensorConf * 0.20 + confidence * 0.15,
  );

  return {
    event: {
      id: tweet.id,
      text: tweet.text, // original text
      translatedText: isTranslated ? translatedText : null, // keep translation if not English
      handle: tweet.handle,
      source: tweet.source,
      timestamp: tweet.timestamp,
      pollutionType,
      severity,
      severityLevel,
      locations: nlp.locations.length > 0 ? nlp.locations : [geo.matchedName],
      locationName: geo.matchedName || nlp.locations[0],
      state: geo.state,
      lat: eventLat,
      lng: eventLng,
      locationSource: submittedCoords ? "user_pin" : "geocoded_text",
      confidence,
      fusedConfidence: Math.round(fusedConfidence * 100) / 100,
      sensorCorroboration,
      affectedCount: nlp.affectedCount,
      relevancyScore: nlp.relevancyScore,
      relevancyBreakdown: nlp.relevancyBreakdown,
      engagement: tweet.engagement || {},
      imageUrl: tweet.imageUrl || tweet.imageDataUrl || null,
      imageMeta: tweet.imageMeta || null,
      imageAnalysis,
    },
    reason: null,
    nlp,
    imageAnalysis,
  };
}

async function processTweet(tweet) {
  const result = await processTweetDetailed(tweet);
  return result.event;
}

// --- REST Endpoints ---
app.get("/api/events", (req, res) => {
  const { start, end } = req.query;
  if (start && end) {
    res.json(store.getByTimeRange(Number(start), Number(end)));
  } else {
    res.json(store.getAll());
  }
});

app.get("/api/events/recent", (req, res) => {
  const count = parseInt(req.query.count) || 50;
  res.json(store.getRecent(count));
});

app.get("/api/stats", (req, res) => {
  res.json(store.getStats());
});

app.get("/api/events/filtered", (req, res) => {
  const minRelevancy = parseFloat(req.query.minRelevancy) || 0.4;
  const events = store
    .getAll()
    .filter((e) => (e.relevancyScore || 0) >= minRelevancy);
  res.json(events);
});

app.get("/api/trends", (req, res) => {
  const hours = parseInt(req.query.hours) || 48;
  res.json(store.getTrendData(hours));
});

app.get("/api/heatmap", (req, res) => {
  const { start, end } = req.query;
  res.json(
    store.getHeatmapData(
      start ? Number(start) : null,
      end ? Number(end) : null,
    ),
  );
});

app.get("/api/locations", (req, res) => {
  res.json(
    Object.keys(LOCATIONS).map((loc) =>
      loc
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    ),
  );
});

// --- Sensor readings ---
app.get("/api/sensors", (req, res) => {
  res.json(sensorGrid.getSensorReadings());
});

// --- Weather (Public Data) ---
app.get("/api/weather", async (req, res) => {
  const weather = await getCurrentWeather();
  res.json(weather);
});

// --- Custom tweet submission ---
app.post("/api/tweet", async (req, res) => {
  const { text, handle, location, imageDataUrl, imageMeta, locationCoords } =
    req.body;
  const trimmedText = typeof text === "string" ? text.trim() : "";
  const hasImage = typeof imageDataUrl === "string" && imageDataUrl.length > 0;
  if (!trimmedText && !hasImage) {
    return res.status(400).json({ error: "text or image is required" });
  }

  const tweet = {
    id: `tw_custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    text: trimmedText || "Photo evidence submitted for pollution analysis.",
    handle: handle || "@custom_user",
    source: "manual",
    timestamp: new Date().toISOString(),
    hintLocations: location ? [location.toLowerCase()] : [],
    engagement: { likes: 0, retweets: 0, replies: 0, views: 0 },
    accountMeta: { isVerified: false, followerCount: 100, accountAgeDays: 365 },
    imageDataUrl: imageDataUrl || null,
    imageMeta: imageMeta || null,
    locationCoords: normalizeCoords(locationCoords),
  };

  const result = await processTweetDetailed(tweet);
  const { event } = result;

  if (!event) {
    return res.json({
      accepted: false,
      reason: result.reason,
      nlpResult: result.nlp,
      imageAnalysis: result.imageAnalysis,
      tweet,
    });
  }

  const storedEvent = store.add(event);
  // Register with sensor grid for pressure feedback
  sensorGrid.registerReport(storedEvent.lat, storedEvent.lng, storedEvent.severityLevel || 1);
  broadcastEvent(storedEvent);

  res.json({
    accepted: true,
    event: storedEvent,
  });
});

// --- AI Write: generate/improve report description ---
app.post("/api/ai-write", async (req, res) => {
  const { imageDataUrl, text, location } = req.body;

  if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return res.status(400).json({
      success: false,
      error: "An uploaded image is required for AI Write.",
    });
  }

  const result = await generateReportDescription(imageDataUrl, {
    text: typeof text === "string" ? text : "",
    location: typeof location === "string" ? location : "",
  });

  res.json(result);
});

app.post("/api/simulate", async (req, res) => {
  const count = Math.min(parseInt(req.body?.count) || 10, 50);
  const events = [];
  for (let i = 0; i < count; i++) {
    const tweet = generateTweet();
    const event = await processTweet(tweet);
    if (event) {
      const stored = store.add(event);
      sensorGrid.registerReport(stored.lat, stored.lng, stored.severityLevel || 1);
      broadcastEvent(stored);
      events.push(stored);
    }
  }
  res.json({ generated: events.length, events });
});

// --- Seed historical data on startup ---
async function seedHistoricalData() {
  const historicalTweets = generateHistoricalBatch(80, 48);
  let seeded = 0;
  for (const tweet of historicalTweets) {
    const event = await processTweet(tweet);
    if (event) {
      const stored = store.add(event);
      sensorGrid.registerReport(stored.lat, stored.lng, stored.severityLevel || 1);
      seeded++;
    }
    // Small delay to avoid hammering the translation API
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`📊 Seeded ${seeded} historical events (${store.duplicatesMerged} duplicates merged)`);
}

// --- Auto-generate tweets at intervals ---
let simulationInterval = null;
let simulationSpeed = 8000; // ms between tweets

async function startSimulation() {
  if (simulationInterval) return;
  simulationInterval = setInterval(async () => {
    const tweet = generateTweet();
    const event = await processTweet(tweet);
    if (event) {
      const stored = store.add(event);
      sensorGrid.registerReport(stored.lat, stored.lng, stored.severityLevel || 1);
      broadcastEvent(stored);
    }
  }, simulationSpeed);
  console.log(`▶️  Simulation started (interval: ${simulationSpeed}ms)`);
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("⏸️  Simulation paused");
  }
}

app.post("/api/simulation/start", (req, res) => {
  simulationSpeed = Math.max(2000, parseInt(req.body?.interval) || 8000);
  stopSimulation();
  startSimulation();
  res.json({ status: "running", interval: simulationSpeed });
});

app.post("/api/simulation/stop", (req, res) => {
  stopSimulation();
  res.json({ status: "stopped" });
});

app.get("/api/simulation/status", (req, res) => {
  res.json({ running: !!simulationInterval, interval: simulationSpeed });
});

// --- Serve static files (production) ---
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

// Serve images from public folder
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
);

// SPA catch-all — must be after all API routes
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// --- Start ---
seedHistoricalData();
startSimulation();

app.listen(PORT, () => {
  console.log(`\n🌫️ VayuAI Server running on http://localhost:${PORT}`);
  console.log(`📡 SSE stream: http://localhost:${PORT}/api/events/stream`);
  console.log(`🗺️  Events: http://localhost:${PORT}/api/events\n`);
});
