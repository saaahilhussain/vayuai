const POLLUTION_TYPES = new Set([
  "garbage_burning",
  "industrial_smoke",
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
  try {
    return JSON.parse(candidate.slice(start, end + 1));
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

  if (directText) return directText;

  return JSON.stringify(payload);
}

function normalizeAnalysis(raw, fallback = {}) {
  const severity = SEVERITY_LEVELS[raw?.severity] ? raw.severity : "low";
  const pollutionType = POLLUTION_TYPES.has(raw?.pollutionType)
    ? raw.pollutionType
    : "other";
  const isPollution = Boolean(raw?.isPollution) && pollutionType !== "other";

  return {
    provider: "gemini",
    available: true,
    isPollution,
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
    textImageMatch:
      typeof raw?.textImageMatch === "boolean" ? raw.textImageMatch : null,
    mismatchReason:
      typeof raw?.mismatchReason === "string"
        ? raw.mismatchReason.slice(0, 220)
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
    textImageMatch: null,
    mismatchReason: "",
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

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const locationText = context.location
    ? `Location hint: ${context.location}.`
    : "";
  const reportText = context.text ? `Citizen text: ${context.text}` : "";

  const prompt = `
You are classifying citizen-submitted pollution evidence for a municipal dashboard in Guwahati.
Return strict JSON only. Do not wrap it in markdown.

Only approve the image if it visibly shows one of these target cases:
- garbage_burning: garbage dump fires or illegal waste burning with visible flame, smoke, ash, or burning waste
- industrial_smoke: visible smoke or emissions from a factory, kiln, chimney, stack, plant, or industrial site
- construction_dust: visible dust clouds, uncovered construction material, demolition dust, or active construction dust pollution
- garbage_dumping: visible illegal waste dumping, garbage piles, overflowing waste, or localized trash pollution pockets
- smog: visible smog or haze accumulation, especially at busy traffic junctions or localized pollution pockets

Use pollutionType "other" and isPollution false for ordinary streets, buildings, people, vehicles without visible emissions, greenery, water/flooding, food, indoor scenes, screenshots, documents, or any image where the target pollution evidence is not clearly visible.

Classify approved images into exactly one of:
garbage_burning, industrial_smoke, construction_dust, garbage_dumping, smog.

Estimate severity as one of: low, moderate, high, critical.
Use critical only for severe visible fire/smoke, dense hazardous plumes, or conditions likely to require urgent field response.

If citizen text is provided, verify that it describes the same visible incident type as the image. A text report about flooding, traffic, accidents, waterlogging, unrelated civic issues, or a different pollution type does not match a garbage/smoke/dust/smog image.

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
  "recommendedText": string,
  "textImageMatch": boolean,
  "mismatchReason": string
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
                inline_data: {
                  mime_type: parsed.mimeType,
                  data: parsed.data,
                },
              },
            ],
          },
        ],
        generation_config: {
          temperature: 0.1,
          response_mime_type: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return unavailable(
        `Gemini request failed: ${response.status} ${body}`,
        context,
      );
    }

    const payload = await response.json();
    const text = extractResponseText(payload);
    const raw = extractJson(text);
    if (!raw) {
      console.warn("Gemini returned unreadable payload:", text.slice(0, 500));
      return unavailable(
        `Gemini returned an unreadable response: ${text.slice(0, 240)}`,
        context,
      );
    }

    return normalizeAnalysis(raw, context);
  } catch (err) {
    return unavailable(err.message || "Gemini image analysis failed", context);
  }
}

async function generateReportDescription(dataUrl, context = {}) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { success: false, error: "Invalid image data" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "GEMINI_API_KEY is not configured" };

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const locationHint = context.location ? `Location hint: ${context.location}.` : "";
  const hasUserText = typeof context.text === "string" && context.text.trim().length >= 5;
  const userTextBlock = hasUserText ? `Citizen's current description: "${context.text.trim()}"` : "";

  const prompt = `
You are helping a citizen write a pollution incident report for a municipal dashboard in Guwahati, India.

Analyze the uploaded photo carefully.

The platform tracks these pollution types:
- Garbage dump fires / illegal waste burning
- Industrial smoke emissions
- Construction dust
- Smog accumulation at busy traffic junctions
- Localized pollution pockets / illegal dumping

TASK:
${hasUserText
  ? `The citizen has written their own description. First, check if it matches what is actually visible in the image.

${userTextBlock}

If the description accurately describes what the image shows (even roughly), improve and expand it into a detailed 2-3 sentence report. Set scenario to "improve" and mismatchWarning to "".

If the description does NOT match the image (e.g. text says flooding/storm/accident but image shows garbage/smoke/dust), set scenario to "mismatch", write a brief mismatchWarning explaining what the text says vs what the image actually shows, and write a corrected generatedText based only on what is visible in the image.`
  : `No description has been provided. Analyze the image and write a detailed 2-3 sentence first-person citizen report describing the visible pollution incident. Set scenario to "image_only" and mismatchWarning to "".`}

${locationHint}

Write in a natural, concerned citizen tone — not robotic. Mention specific visible details (color of smoke, size of dump, density of dust, etc.).

Return strict JSON only. Do not wrap in markdown.

JSON schema:
{
  "generatedText": string,
  "scenario": "image_only" | "improve" | "mismatch",
  "mismatchWarning": string,
  "isPollution": boolean,
  "pollutionType": string
}

If the image does not show any recognizable pollution, set isPollution to false and generatedText to "" and scenario to "image_only".
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
                inline_data: {
                  mime_type: parsed.mimeType,
                  data: parsed.data,
                },
              },
            ],
          },
        ],
        generation_config: {
          temperature: 0.4,
          response_mime_type: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `Gemini request failed: ${response.status} ${body}` };
    }

    const payload = await response.json();
    const text = extractResponseText(payload);
    const raw = extractJson(text);

    if (!raw) {
      return { success: false, error: "Gemini returned an unreadable response" };
    }

    if (raw.isPollution === false || !raw.generatedText) {
      return {
        success: false,
        error: "The image does not appear to show pollution. Please upload a photo showing garbage burning, smoke, dust, smog, or illegal dumping.",
      };
    }

    return {
      success: true,
      generatedText: typeof raw.generatedText === "string" ? raw.generatedText.slice(0, 500) : "",
      scenario: ["image_only", "improve", "mismatch"].includes(raw.scenario) ? raw.scenario : "image_only",
      mismatchWarning: typeof raw.mismatchWarning === "string" ? raw.mismatchWarning.slice(0, 300) : "",
      pollutionType: POLLUTION_TYPES.has(raw.pollutionType) ? raw.pollutionType : "other",
    };
  } catch (err) {
    return { success: false, error: err.message || "AI Write failed" };
  }
}

export { analyzePollutionImage, generateReportDescription };
