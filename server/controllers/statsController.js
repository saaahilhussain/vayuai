import { store, sensorGrid } from "../services/shared.js";
import { HotspotEngine } from "../services/hotspotEngine.js";
import { PredictionEngine } from "../services/predictionEngine.js";
import { MunicipalEngine } from "../services/municipalEngine.js";
import { getCurrentWeather } from "../services/weatherService.js";

let municipalCache = { data: null, timestamp: 0 };

export function getStats(req, res) {
  res.json(store.getStats());
}

export function getTrends(req, res) {
  const hours = parseInt(req.query.hours) || 48;
  res.json(store.getTrendData(hours));
}

export function getSensors(req, res) {
  res.json(sensorGrid.getSensorReadings());
}

export async function getWeather(req, res) {
  const weather = await getCurrentWeather();
  res.json(weather);
}

export function getHotspots(req, res) {
  const now = Date.now();
  const recentEvents = store.getByTimeRange(now - 6 * 3600 * 1000, now);
  const hotspots = HotspotEngine.generateHotspots(recentEvents, sensorGrid);
  res.json(hotspots);
}

export async function getPredictions(req, res) {
  const now = Date.now();
  const recentEvents = store.getByTimeRange(now - 48 * 3600 * 1000, now);
  const hotspots = HotspotEngine.generateHotspots(store.getByTimeRange(now - 6 * 3600 * 1000, now), sensorGrid);
  const weather = await getCurrentWeather();
  
  const predictions = PredictionEngine.generatePredictions(sensorGrid, recentEvents, weather, hotspots);
  res.json(predictions);
}

export async function getMunicipalBrief(req, res) {
  const now = Date.now();
  
  if (municipalCache.data && (now - municipalCache.timestamp < 300000)) {
    return res.json({ cached: true, actions: municipalCache.data });
  }

  try {
    const recentEvents6h = store.getByTimeRange(now - 6 * 3600 * 1000, now);
    const recentEvents48h = store.getByTimeRange(now - 48 * 3600 * 1000, now);
    
    const hotspots = HotspotEngine.generateHotspots(recentEvents6h, sensorGrid);
    const weather = await getCurrentWeather();
    const predictions = PredictionEngine.generatePredictions(sensorGrid, recentEvents48h, weather, hotspots);
    
    const actions = await MunicipalEngine.generateBrief(hotspots, predictions, weather);
    
    municipalCache = { data: actions, timestamp: now };
    res.json({ cached: false, actions });
  } catch (err) {
    console.error("Error generating municipal brief:", err);
    res.status(500).json({ error: "Failed to generate brief" });
  }
}
