// VayuAI — Real & Virtual AQI Sensor Grid
// Uses live CPCB data via OpenAQ where available, with virtual fallbacks

const SENSORS = [
  // CPCB Stations (Real Data targets)
  { id: "SEN-PNB", name: "Panbazar (CPCB)",        lat: 26.1872, lng: 91.7441, baseAqi: 140, type: "market", isReal: true },
  { id: "SEN-RLY", name: "Railway Station (CPCB)", lat: 26.1815, lng: 91.7443, baseAqi: 160, type: "junction", isReal: true },
  { id: "SEN-IIT", name: "IIT Guwahati (CPCB)",    lat: 26.1850, lng: 91.6600, baseAqi: 110, type: "residential", isReal: true },
  { id: "SEN-LGB", name: "LGBI Airport (CPCB)",    lat: 26.1050, lng: 91.5850, baseAqi: 120, type: "airport", isReal: true },
  // Virtual Stations (for full city coverage)
  { id: "SEN-BRG", name: "Boragaon Landfill",      lat: 26.1150, lng: 91.6850, baseAqi: 280, type: "dumpsite", isReal: false },
  { id: "SEN-NMT", name: "Noonmati Refinery",      lat: 26.1830, lng: 91.7920, baseAqi: 220, type: "industrial", isReal: false },
  { id: "SEN-6ML", name: "Six Mile Junction",      lat: 26.1350, lng: 91.8000, baseAqi: 155, type: "junction", isReal: false },
  { id: "SEN-DSP", name: "Dispur",                 lat: 26.1430, lng: 91.7900, baseAqi: 105, type: "locality", isReal: false },
];

function aqiCategory(aqi) {
  if (aqi <= 50)  return { label: "Good",         color: "#4ade80" };
  if (aqi <= 100) return { label: "Satisfactory",  color: "#a3e635" };
  if (aqi <= 200) return { label: "Moderate",      color: "#facc15" };
  if (aqi <= 300) return { label: "Poor",           color: "#f97316" };
  if (aqi <= 400) return { label: "Very Poor",      color: "#ef4444" };
  return                  { label: "Severe",         color: "#991b1b" };
}

function diurnalMultiplier(hour) {
  const table = [
    0.65, 0.60, 0.55, 0.55, 0.60, 0.70,
    0.80, 1.05, 1.15, 1.10, 1.00, 0.90,
    0.95, 0.90, 0.85, 0.85, 0.90, 1.05,
    1.15, 1.10, 1.00, 0.90, 0.80, 0.70,
  ];
  return table[hour] || 0.85;
}

function readingNoise() {
  return 1 + (Math.random() - 0.5) * 0.12;
}

function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Convert PM2.5 to Indian NAQI (simplified approximation)
function pm25ToAQI(pm25) {
  if (pm25 <= 30) return Math.round(pm25 * (50 / 30));
  if (pm25 <= 60) return Math.round(50 + (pm25 - 30) * (50 / 30));
  if (pm25 <= 90) return Math.round(100 + (pm25 - 60) * (100 / 30));
  if (pm25 <= 120) return Math.round(200 + (pm25 - 90) * (100 / 30));
  if (pm25 <= 250) return Math.round(300 + (pm25 - 120) * (100 / 130));
  return Math.round(400 + (pm25 - 250) * (100 / 130));
}

class SensorGrid {
  constructor() {
    this.sensors = SENSORS.map((s) => ({
      ...s,
      readings: [],
      reportPressure: 0,
      reportPressureUpdatedAt: Date.now(),
      realAqi: null,
      realPm25: null,
      realPm10: null,
      lastFetch: 0
    }));
    
    // Start background fetch for CPCB data
    this.fetchCPCBData();
    setInterval(() => this.fetchCPCBData(), 30 * 60 * 1000); // 30 mins
  }

  async fetchCPCBData() {
    try {
      const res = await fetch("https://api.openaq.org/v2/latest?city=Guwahati&limit=10");
      if (!res.ok) throw new Error("OpenAQ API Error");
      const data = await res.json();
      
      data.results.forEach(loc => {
        const nameLower = loc.location.toLowerCase();
        let targetId = null;
        if (nameLower.includes("panbazar")) targetId = "SEN-PNB";
        else if (nameLower.includes("railway")) targetId = "SEN-RLY";
        else if (nameLower.includes("iit")) targetId = "SEN-IIT";
        else if (nameLower.includes("airport") || nameLower.includes("lgbi")) targetId = "SEN-LGB";
        
        if (targetId) {
          const sensor = this.sensors.find(s => s.id === targetId);
          if (sensor) {
            const pm25Reading = loc.measurements.find(m => m.parameter === "pm25");
            const pm10Reading = loc.measurements.find(m => m.parameter === "pm10");
            
            if (pm25Reading) {
              sensor.realPm25 = Math.round(pm25Reading.value);
              sensor.realAqi = pm25ToAQI(sensor.realPm25);
              if (pm10Reading) sensor.realPm10 = Math.round(pm10Reading.value);
              sensor.lastFetch = Date.now();
            }
          }
        }
      });
      console.log("📡 Fetched live CPCB data for Guwahati sensors.");
    } catch (e) {
      console.error("⚠️ Failed to fetch CPCB data, falling back to simulated data.", e.message);
    }
  }

  registerReport(lat, lng, severityLevel = 1) {
    for (const sensor of this.sensors) {
      const dist = haversineKm(sensor, { lat, lng });
      if (dist <= 2.0) {
        const boost = Math.max(0, (2.0 - dist) / 2.0) * severityLevel * 15;
        sensor.reportPressure += boost;
        sensor.reportPressureUpdatedAt = Date.now();
      }
    }
  }

  _computeReading(sensor) {
    const now = new Date();
    const hour = now.getHours();

    const elapsed = (Date.now() - sensor.reportPressureUpdatedAt) / 1000;
    sensor.reportPressure *= Math.exp(-elapsed / 600);
    sensor.reportPressureUpdatedAt = Date.now();

    let aqi, pm25, pm10;

    // Use live CPCB data if available and fresh (< 2 hours)
    if (sensor.isReal && sensor.realAqi && (Date.now() - sensor.lastFetch < 2 * 3600 * 1000)) {
      aqi = Math.round(sensor.realAqi + sensor.reportPressure);
      pm25 = sensor.realPm25;
      pm10 = sensor.realPm10 || Math.round(pm25 * 1.5);
    } else {
      // Simulated Fallback
      const raw = sensor.baseAqi * diurnalMultiplier(hour) * readingNoise() + sensor.reportPressure;
      aqi = Math.round(Math.max(20, Math.min(500, raw)));
      pm25 = Math.round(aqi * 0.38 + Math.random() * 10);
      pm10 = Math.round(aqi * 0.55 + Math.random() * 15);
    }

    const cat = aqiCategory(aqi);
    const reading = {
      aqi,
      pm25,
      pm10,
      category: cat.label,
      color: cat.color,
      timestamp: now.toISOString(),
      isRealData: sensor.isReal && sensor.realAqi !== null
    };

    sensor.readings.push(reading);
    if (sensor.readings.length > 240) {
      sensor.readings = sensor.readings.slice(-240);
    }

    return reading;
  }

  getSensorReadings() {
    return this.sensors.map((sensor) => {
      const reading = this._computeReading(sensor);
      return {
        id: sensor.id,
        name: sensor.name,
        lat: sensor.lat,
        lng: sensor.lng,
        type: sensor.type,
        isReal: sensor.isReal,
        ...reading,
        trend: sensor.readings.slice(-6).map((r) => r.aqi),
      };
    });
  }

  getNearestSensor(lat, lng) {
    let best = null;
    let bestDist = Infinity;

    for (const sensor of this.sensors) {
      const dist = haversineKm(sensor, { lat, lng });
      if (dist < bestDist) {
        bestDist = dist;
        best = sensor;
      }
    }

    if (!best) return null;

    const reading = this._computeReading(best);
    return {
      id: best.id,
      name: best.name,
      lat: best.lat,
      lng: best.lng,
      type: best.type,
      isReal: best.isReal,
      distanceKm: Math.round(bestDist * 100) / 100,
      ...reading,
    };
  }

  getSensorByLocation(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    return this.sensors.find(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        lower.includes(s.name.toLowerCase().split(" ")[0]),
    );
  }
}

export { SensorGrid, aqiCategory, SENSORS };
