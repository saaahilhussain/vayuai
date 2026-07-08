// VayuAI — Phase 7 Municipal Action Generation Engine

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    let cleanJson = candidate.slice(start, end + 1);
    cleanJson = cleanJson.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleanJson);
  } catch {
    return null;
  }
}

function extractResponseText(payload) {
  if (!payload || typeof payload !== "object") return "";

  const directText =
    payload.output_text ||
    payload.text ||
    payload.response?.text ||
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");

  return directText || "";
}

const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  ...(process.env.GEMINI_MODELS || "").split(","),
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-002",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
]
  .map((model) =>
    String(model || "")
      .trim()
      .replace(/^models\//, ""),
  )
  .filter(Boolean)
  .filter((model, index, models) => models.indexOf(model) === index);

async function generateGeminiContent(apiKey, payload) {
  const failures = [];

  for (const model of GEMINI_MODEL_CANDIDATES) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) return await response.json();

    const body = await response.text();
    failures.push({ model, status: response.status, body });

    if (![400, 404].includes(response.status)) break;
  }

  const summary = failures
    .map(({ model, status }) => `${model} (${status})`)
    .join(", ");
  const lastFailure = failures[failures.length - 1];
  throw new Error("API credits are exhausted. Contact admin or try again later.");
}

class MunicipalEngine {
  /**
   * Generate actionable municipal recommendations using Gemini.
   */
  static async generateBrief(hotspots, predictions, weather) {
    const apiKey = process.env.GEMINI_API_KEY;

    // If no API key is provided, return a fallback response so the UI still works
    if (!apiKey) {
      console.warn(
        "MunicipalEngine: No GEMINI_API_KEY found, using fallback logic.",
      );
      return this._generateFallback(hotspots, predictions, weather);
    }

    // Prepare context for Gemini
    const topHotspots = (hotspots || [])
      .slice(0, 3)
      .map(
        (h) =>
          `Location: ${h.locationName}, Severity: ${h.severity}, Predominant Issue: ${h.predominantType}, Events: ${h.eventCount}`,
      )
      .join("\n");

    const topPredictions = (predictions?.locations || [])
      .slice(0, 3)
      .map(
        (p) =>
          `Location: ${p.name}, Current AQI: ${p.currentAQI}, Predicted Peak AQI: ${p.peakAQI} at ${p.peakHour}:00`,
      )
      .join("\n");

    const weatherContext = weather
      ? `Temperature: ${weather.temperature}°C, Wind Speed: ${weather.windSpeed}km/h`
      : "Unknown";

    const prompt = `
You are an AI assistant for a municipal pollution control board in Guwahati, India.
Your task is to analyze the current city pollution data and generate 3 to 5 highly actionable recommendations for municipal response teams.

Context:
--- Weather ---
${weatherContext}

--- Top Active Hotspots ---
${topHotspots || "None currently active."}

--- Worst 24h Predictions ---
${topPredictions || "No predictions available."}

Based on this data, recommend specific physical interventions. Use the provided context to justify the recommendation.
Return ONLY a strict JSON array of objects. Do not use markdown wrappers.

JSON Schema for each object:
{
  "title": "Short title of the action, e.g. Deploy Water Mist Cannons",
  "location": "The neighborhood or street name",
  "reason": "Why this action is needed, referencing the context data",
  "resourceType": "must be one of: water_cannon, cleanup_crew, inspection, traffic_police",
  "priority": "Critical, High, or Medium"
}
`;

    try {
      const payload = await generateGeminiContent(apiKey, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          maxOutputTokens: 700,
        },
      });

      const text = extractResponseText(payload);
      const actions = extractJson(text);

      if (Array.isArray(actions) && actions.length > 0) {
        // Normalize resourceTypes to match frontend icons
        return actions.map((a) => ({
          ...a,
          resourceType: [
            "water_cannon",
            "cleanup_crew",
            "inspection",
            "traffic_police",
          ].includes(a.resourceType)
            ? a.resourceType
            : "inspection",
        }));
      }

      throw new Error("Failed to parse valid JSON array from Gemini response.");
    } catch (err) {
      console.error("MunicipalEngine error:", err);
      return this._generateFallback(hotspots, predictions, weather);
    }
  }

  static _generateFallback(hotspots, predictions, weather) {
    const actions = [];

    if (hotspots && hotspots.length > 0) {
      const hs = hotspots[0];
      if (
        hs.predominantType.includes("dust") ||
        hs.predominantType.includes("smog")
      ) {
        actions.push({
          title: "Deploy Water Mist Cannon",
          location: hs.locationName,
          reason: `High concentration of ${hs.predominantType.replace("_", " ")} detected locally.`,
          resourceType: "water_cannon",
          priority: hs.severity === "critical" ? "Critical" : "High",
        });
      } else {
        actions.push({
          title: "Dispatch Cleanup Crew",
          location: hs.locationName,
          reason: `Multiple reports of ${hs.predominantType.replace("_", " ")} in the area.`,
          resourceType: "cleanup_crew",
          priority: hs.severity === "critical" ? "Critical" : "High",
        });
      }
    }

    if (
      predictions &&
      predictions.locations &&
      predictions.locations.length > 0
    ) {
      const worst = predictions.locations[0];
      if (worst.peakAQI > 300) {
        actions.push({
          title: "Traffic Diversion Warning",
          location: worst.name,
          reason: `Predicted peak AQI of ${worst.peakAQI} expected around ${String(worst.peakHour).padStart(2, "0")}:00.`,
          resourceType: "traffic_police",
          priority: "Medium",
        });
      }
    }

    if (actions.length === 0) {
      actions.push({
        title: "General Area Inspection",
        location: "City Center",
        reason: "Routine inspection to ensure baseline air quality.",
        resourceType: "inspection",
        priority: "Low",
      });
    }

    return actions;
  }
}

export { MunicipalEngine };
