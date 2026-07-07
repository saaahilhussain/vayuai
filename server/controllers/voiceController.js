import { SpeechClient } from '@google-cloud/speech';
import { processTweetDetailed } from './tweetController.js';
import { store, sensorGrid, broadcastEvent } from '../services/shared.js';

// Setup Speech client. It will use GOOGLE_APPLICATION_CREDENTIALS if available.
let speechClient = null;
try {
  speechClient = new SpeechClient();
} catch (error) {
  console.warn("SpeechClient initialization failed. Make sure GOOGLE_APPLICATION_CREDENTIALS is set.");
}

function parseAudioDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  // Browser standard MediaRecorder output (webm)
  const match = dataUrl.match(/^data:(audio\/[a-zA-Z0-9.+-]+);(?:codecs=[^;]+;)?base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export async function postVoiceTweet(req, res) {
  const { audioDataUrl, location, locationCoords, citizenUid } = req.body;

  if (!audioDataUrl) {
    return res.status(400).json({ error: "Missing audioDataUrl" });
  }

  const audioObj = parseAudioDataUrl(audioDataUrl);
  if (!audioObj) {
    return res.status(400).json({ error: "Invalid audio format. Must be base64 data URI." });
  }

  let text = "";

  if (speechClient && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const audio = {
        content: audioObj.data,
      };
      
      const config = {
        encoding: "WEBM_OPUS", 
        sampleRateHertz: 48000,
        languageCode: "en-IN", 
        alternativeLanguageCodes: ["hi-IN", "as-IN"],
      };

      const request = {
        audio: audio,
        config: config,
      };

      const [response] = await speechClient.recognize(request);
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join("\n");
      
      text = transcription;
    } catch (err) {
      console.error("Speech-to-Text API Error:", err);
      text = "Voice transcription failed: " + err.message;
    }
  } else {
    // Mock processing for local dev if GCP not configured
    console.warn("Google Cloud Speech not configured, using mock transcription.");
    text = "Mock transcribed voice report about pollution. Garbage burning near the road.";
  }

  if (!text || text.trim() === "") {
    return res.status(400).json({ error: "Could not transcribe audio. Please try again or type it out." });
  }

  const tweet = {
    id: `tw_voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    text: text,
    handle: "Citizen (Voice)",
    source: "manual_voice",
    timestamp: new Date().toISOString(),
    hintLocations: location ? [location.toLowerCase()] : [],
    engagement: { likes: 0, retweets: 0, replies: 0, views: 0 },
    accountMeta: { isVerified: false, followerCount: 1, accountAgeDays: 1 },
    imageDataUrl: null,
    imageUrl: null,
    videoFrames: null,
    imageMeta: null,
    locationCoords: locationCoords || null,
    citizenUid: citizenUid || null,
  };

  const result = await processTweetDetailed(tweet);
  const { event } = result;

  if (!event) {
    return res.json({
      accepted: false,
      reason: result.reason,
      nlpResult: result.nlp,
      tweet,
    });
  }

  const storedEvent = store.add(event);
  sensorGrid.registerReport(storedEvent.lat, storedEvent.lng, storedEvent.severityLevel || 1);
  broadcastEvent(storedEvent);

  res.json({ accepted: true, event: storedEvent, transcription: text });
}
