// API helpers + constants

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

export async function fetchEvents() {
  const res = await fetch(`${API_BASE}/events`);
  return res.json();
}

export async function fetchEventsByTime(start, end) {
  const res = await fetch(`${API_BASE}/events?start=${start}&end=${end}`);
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  return res.json();
}

export async function fetchTrends(hours = 48) {
  const res = await fetch(`${API_BASE}/trends?hours=${hours}`);
  return res.json();
}

export async function fetchHeatmap(start, end) {
  let url = `${API_BASE}/heatmap`;
  if (start && end) url += `?start=${start}&end=${end}`;
  const res = await fetch(url);
  return res.json();
}

export async function startSimulation(interval = 8000) {
  const res = await fetch(`${API_BASE}/simulation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interval }),
  });
  return res.json();
}

export async function stopSimulation() {
  const res = await fetch(`${API_BASE}/simulation/stop`, { method: 'POST' });
  return res.json();
}

export async function simulateBatch(count = 10) {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  });
  return res.json();
}

export async function postCustomTweet(
  text,
  handle,
  location,
  imageDataUrl = null,
  videoFrames = null,
  imageMeta = null,
  locationCoords = null,
  storageUrl = null,
) {
  const res = await fetch(`${API_BASE}/tweet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      handle,
      location,
      imageDataUrl,
      videoFrames,
      imageMeta,
      locationCoords,
      storageUrl,
    }),
  });
  return res.json();
}

export async function aiWriteReport(imageDataUrl, text, location) {
  const res = await fetch(`${API_BASE}/ai-write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, text, location }),
  });
  return res.json();
}

export async function fetchLocations() {
  const res = await fetch(`${API_BASE}/locations`);
  return res.json();
}

export async function fetchSensors() {
  const res = await fetch(`${API_BASE}/sensors`);
  return res.json();
}

export async function fetchHotspots() {
  const res = await fetch(`${API_BASE}/hotspots`);
  return res.json();
}

export async function fetchPredictions() {
  const res = await fetch(`${API_BASE}/predictions`);
  return res.json();
}

export async function fetchMunicipalBrief() {
  const res = await fetch(`${API_BASE}/municipal-brief`);
  return res.json();
}

export function createEventStream(onEvent) {
  const es = new EventSource(`${API_BASE}/events/stream`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type !== 'connected') {
        onEvent(data);
      }
    } catch (err) {
      console.error('SSE parse error:', err);
    }
  };
  es.onerror = () => {
    console.warn('SSE connection error, reconnecting...');
  };
  return es;
}

// Pollution type config
export const POLLUTION_TYPES = {
  garbage_burning: { label: 'Garbage Burning', icon: '🔥', color: 'hsl(15, 85%, 55%)' },
  industrial_smoke: { label: 'Industrial Emission', icon: '🏭', color: 'hsl(280, 45%, 55%)' },
  vehicle_pollution: { label: 'Vehicle Pollution', icon: '🚗', color: 'hsl(210, 70%, 55%)' },
  construction_dust: { label: 'Construction Dust', icon: '🏗️', color: 'hsl(35, 80%, 55%)' },
  garbage_dumping: { label: 'Illegal Dumping', icon: '🗑️', color: 'hsl(120, 40%, 45%)' },
  smog: { label: 'Smog / Haze', icon: '🌫️', color: 'hsl(240, 20%, 55%)' },
  other: { label: 'Other', icon: '⚠️', color: 'hsl(45, 70%, 55%)' },
};

export const SEVERITY_COLORS = {
  critical: 'hsl(0, 85%, 55%)',
  high: 'hsl(30, 90%, 55%)',
  moderate: 'hsl(45, 95%, 55%)',
  low: 'hsl(140, 65%, 50%)',
};

export function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
