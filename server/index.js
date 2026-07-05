// VayuAI Express Server — REST API + SSE for real-time streaming

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { processText } from "./nlpPipeline.js";
import { translateText } from "./translator.js";
import { geocodeBest, jitter, LOCATIONS } from "./geocoder.js";
import { generateTweet, generateHistoricalBatch } from "./fakeData.js";
import { EventStore } from "./eventStore.js";
import { analyzePollutionImage } from "./imageAnalysis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "8mb" }));

const store = new EventStore(500);
const sseClients = [];

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
    imageAnalysis.confidence >= 0.45;

  if (!nlp.isPollution && !hasVisionPollution) {
    return {
      event: null,
      reason: analysisUnavailableReason(imageAnalysis) ||
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

  const geo = geocodeBest(
    nlp.locations.length > 0 ? nlp.locations : tweet.hintLocations || [],
  );
  if (!geo) {
    return {
      event: null,
      reason: "Could not map the report to a known Guwahati location",
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
    locations: nlp.locations,
    locationName: geo.matchedName || nlp.locations[0],
    state: geo.state,
    lat: jitter(geo.lat),
    lng: jitter(geo.lng),
    confidence,
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

// --- Custom tweet submission ---
app.post("/api/tweet", async (req, res) => {
  const { text, handle, location, imageDataUrl, imageMeta } = req.body;
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

  store.add(event);
  broadcastEvent(event);

  res.json({
    accepted: true,
    event,
  });
});

app.post("/api/simulate", async (req, res) => {
  const count = Math.min(parseInt(req.body?.count) || 10, 50);
  const events = [];
  for (let i = 0; i < count; i++) {
    const tweet = generateTweet();
    const event = await processTweet(tweet);
    if (event) {
      store.add(event);
      broadcastEvent(event);
      events.push(event);
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
      store.add(event);
      seeded++;
    }
    // Small delay to avoid hammering the translation API
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`📊 Seeded ${seeded} historical events`);
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
      store.add(event);
      broadcastEvent(event);
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
app.use("/images", express.static(path.join(__dirname, "..", "public", "images")));

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
