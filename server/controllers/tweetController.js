import { processText } from "../services/nlpPipeline.js";
import { translateText } from "../services/translator.js";
import { geocodeBest, isWithinGuwahatiBounds, jitter, nearestLocation } from "../services/geocoder.js";
import { analyzePollutionImage, analyzeVideoFrames, generateReportDescription } from "../services/imageAnalysis.js";
import { store, sensorGrid, broadcastEvent } from "../services/shared.js";

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

export async function processTweetDetailed(tweet) {
  const hintLoc = tweet.hintLocations?.[0] || "";
  const recentLocationEvents = store.getRecentByLocation(hintLoc);

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

  let imageAnalysis = null;
  if (tweet.videoFrames && tweet.videoFrames.length > 0) {
    imageAnalysis = await analyzeVideoFrames(tweet.videoFrames, {
      text: translatedText,
      location: tweet.hintLocations?.[0] || "",
    });
  } else if (tweet.imageDataUrl) {
    imageAnalysis = await analyzePollutionImage(tweet.imageDataUrl, {
      text: translatedText,
      location: tweet.hintLocations?.[0] || "",
      capturedAt: tweet.imageMeta?.capturedAt || null,
    });
  }

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
      return { event: null, reason: rejectionReason, nlp, imageAnalysis };
    }
  }

  if (!nlp.isPollution && !hasVisionPollution) {
    return {
      event: null,
      reason: analysisUnavailableReason(imageAnalysis) || "No pollution indicators detected in text or image",
      nlp,
      imageAnalysis,
    };
  }

  if (!nlp.isRelevant && tweet.source !== "manual") {
    store.incrementNoiseFiltered();
    console.log(`🚫 Filtered noise (relevancy: ${nlp.relevancyScore}): "${tweet.text.substring(0, 60)}..."`);
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
    : geocodeBest(nlp.locations.length > 0 ? nlp.locations : tweet.hintLocations || []);
    
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
    severityLevel >= 4 ? "critical" : severityLevel === 3 ? "high" : severityLevel === 2 ? "moderate" : "low";
  const pollutionType =
    nlp.isPollution && nlp.pollutionType !== "other"
      ? nlp.pollutionType
      : imageAnalysis?.pollutionType || nlp.pollutionType;
  const confidence = Math.max(
    nlp.confidence || 0,
    hasVisionPollution ? imageAnalysis.confidence || 0 : 0,
  );

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

  const nlpConf = nlp.confidence || 0;
  const imgConf = hasVisionPollution ? (imageAnalysis.confidence || 0) : 0;
  const sensorConf = sensorCorroboration?.corroborates ? Math.min(1.0, nearestSensor.aqi / 400) : 0;
  const fusedConfidence = Math.min(1.0, nlpConf * 0.35 + imgConf * 0.30 + sensorConf * 0.20 + confidence * 0.15);

  return {
    event: {
      id: tweet.id,
      text: tweet.text,
      translatedText: isTranslated ? translatedText : null,
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

export async function processTweet(tweet) {
  const result = await processTweetDetailed(tweet);
  return result.event;
}

export async function postTweet(req, res) {
  const { text, handle, location, imageDataUrl, videoFrames, imageMeta, locationCoords } = req.body;

  if (!text && !imageDataUrl && !videoFrames) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const tweet = {
    id: `tw_custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    text: text || "Photo evidence submitted for pollution analysis.",
    handle: handle || "@custom_user",
    source: "manual",
    timestamp: new Date().toISOString(),
    hintLocations: location ? [location.toLowerCase()] : [],
    engagement: { likes: 0, retweets: 0, replies: 0, views: 0 },
    accountMeta: { isVerified: false, followerCount: 100, accountAgeDays: 365 },
    imageDataUrl: imageDataUrl || null,
    videoFrames: videoFrames || null,
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
  sensorGrid.registerReport(storedEvent.lat, storedEvent.lng, storedEvent.severityLevel || 1);
  broadcastEvent(storedEvent);

  res.json({ accepted: true, event: storedEvent });
}

export async function postAiWrite(req, res) {
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
}
