const POLLUTION_TYPES = new Set([
  "garbage_burning",
  "industrial_smoke",
  "vehicle_pollution",
  "construction_dust",
  "garbage_dumping",
  "smog",
  "other",
]);

const SEVERITY_LEVELS = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeAnalysis(raw, fallback = {}) {
  const severity = SEVERITY_LEVELS[raw?.severity] ? raw.severity : "low";
  const pollutionType = POLLUTION_TYPES.has(raw?.pollutionType)
    ? raw.pollutionType
    : "other";

  return {
    provider: "gemini",
    available: true,
    isPollution: Boolean(raw?.isPollution),
    pollutionType,
    severity,
    severityLevel: SEVERITY_LEVELS[severity],
    confidence: Math.max(0, Math.min(1, Number(raw?.confidence) || 0)),
    visibleSignals: Array.isArray(raw?.visibleSignals)
      ? raw.visibleSignals.slice(0, 6).map(String)
      : [],
    summary: typeof raw?.summary === "string" ? raw.summary.slice(0, 240) : "",
    recommendedText:
      typeof raw?.recommendedText === "string"
        ? raw.recommendedText.slice(0, 280)
        : "",
    capturedAt: fallback.capturedAt || null,
    analyzedAt: new Date().toISOString(),
  };
}

function unavailable(reason, fallback = {}) {
  return {
    provider: "gemini",
    available: false,
    isPollution: false,
    pollutionType: "other",
    severity: "low",
    severityLevel: 1,
    confidence: 0,
    visibleSignals: [],
    summary: "",
    recommendedText: "",
    capturedAt: fallback.capturedAt || null,
    analyzedAt: new Date().toISOString(),
    error: reason,
  };
}

async function analyzePollutionImage(dataUrl, context = {}) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return unavailable("Invalid image data", context);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return unavailable("GEMINI_API_KEY is not configured", context);

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const locationText = context.location ? `Location hint: ${context.location}.` : "";
  const reportText = context.text ? `Citizen text: ${context.text}` : "";

  const prompt = `
You are classifying citizen-submitted pollution evidence for a municipal dashboard in Guwahati.
Return strict JSON only. Do not wrap it in markdown.

Classify the image into one of these pollutionType values:
garbage_burning, industrial_smoke, vehicle_pollution, construction_dust, garbage_dumping, smog, other.

Estimate severity as one of: low, moderate, high, critical.
Use critical only for severe visible fire/smoke, dense hazardous plumes, or conditions likely to require urgent field response.

${locationText}
${reportText}

JSON schema:
{
  "isPollution": boolean,
  "pollutionType": string,
  "severity": string,
  "confidence": number,
  "visibleSignals": string[],
  "summary": string,
  "recommendedText": string
}
`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: parsed.mimeType,
                  data: parsed.data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return unavailable(`Gemini request failed: ${response.status} ${body}`, context);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    const raw = extractJson(text);
    if (!raw) return unavailable("Gemini returned an unreadable response", context);

    return normalizeAnalysis(raw, context);
  } catch (err) {
    return unavailable(err.message || "Gemini image analysis failed", context);
  }
}

export { analyzePollutionImage };
