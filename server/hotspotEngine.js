// VayuAI — Spatial Clustering Engine for Pollution Hotspots

/**
 * Haversine distance in km.
 */
function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Map severity to numeric weight
 */
const SEVERITY_WEIGHT = {
  low: 1,
  moderate: 2,
  high: 4,
  critical: 8,
};

class HotspotEngine {
  /**
   * Generates ranked hotspots from recent events.
   * @param {Array} events - List of recent events (e.g., last 6 hours)
   * @param {SensorGrid} sensorGrid - Reference to the sensor grid to pull local AQI
   * @returns {Array} Ranked list of hotspots
   */
  static generateHotspots(events, sensorGrid) {
    // 1. Grid-based spatial clustering (approx 500m x 500m cells)
    const gridSize = 0.005; 
    const clusters = new Map();

    for (const event of events) {
      if (!event.lat || !event.lng) continue;

      const gridLat = Math.round(event.lat / gridSize) * gridSize;
      const gridLng = Math.round(event.lng / gridSize) * gridSize;
      const gridKey = `${gridLat.toFixed(4)},${gridLng.toFixed(4)}`;

      if (!clusters.has(gridKey)) {
        clusters.set(gridKey, {
          gridLat,
          gridLng,
          events: [],
          types: {},
          locationNames: {},
        });
      }

      const cluster = clusters.get(gridKey);
      cluster.events.push(event);
      
      // Track pollution types for dominant type
      cluster.types[event.pollutionType] = (cluster.types[event.pollutionType] || 0) + 1;
      
      // Track location names to pick the best label
      if (event.locationName) {
        cluster.locationNames[event.locationName] = (cluster.locationNames[event.locationName] || 0) + 1;
      }
    }

    // 2. Process clusters into hotspots
    const hotspots = [];
    let idCounter = 1;

    for (const [key, cluster] of clusters.entries()) {
      // Ignore single-event "clusters" unless it's critical
      if (cluster.events.length < 2 && cluster.events[0].severity !== 'critical') {
        continue;
      }

      // Calculate centroid
      let sumLat = 0, sumLng = 0, totalWeight = 0;
      let maxSeverity = 'low';
      let sumConfidence = 0;

      for (const event of cluster.events) {
        const weight = SEVERITY_WEIGHT[event.severity] || 1;
        sumLat += event.lat * weight;
        sumLng += event.lng * weight;
        totalWeight += weight;
        sumConfidence += (event.fusedConfidence || event.confidence || 0.5);

        if (SEVERITY_WEIGHT[event.severity] > SEVERITY_WEIGHT[maxSeverity]) {
          maxSeverity = event.severity;
        }
      }

      const centroidLat = sumLat / totalWeight;
      const centroidLng = sumLng / totalWeight;
      const avgConfidence = sumConfidence / cluster.events.length;

      // Determine dominant pollution type
      const dominantType = Object.entries(cluster.types)
        .sort((a, b) => b[1] - a[1])[0][0];

      // Determine best location name
      let locationName = "Unknown Area";
      if (Object.keys(cluster.locationNames).length > 0) {
        locationName = Object.entries(cluster.locationNames)
          .sort((a, b) => b[1] - a[1])[0][0];
      }

      // 3. Sensor Ground Truth Integration
      const nearestSensor = sensorGrid ? sensorGrid.getNearestSensor(centroidLat, centroidLng) : null;
      let sensorBoost = 1.0;
      let sensorAqi = null;

      if (nearestSensor && nearestSensor.distanceKm < 2.0 && nearestSensor.aqi > 150) {
        sensorBoost = 1.0 + (nearestSensor.aqi - 150) / 200; // Boost score up to +1.5x based on AQI severity
        sensorAqi = nearestSensor.aqi;
      }

      // 4. Calculate Final Hotspot Score
      // Base score: (Event Count * Average Severity Weight * Avg Confidence)
      // Multiplied by sensor ground truth boost
      const baseScore = cluster.events.length * (totalWeight / cluster.events.length) * avgConfidence;
      const finalScore = Math.round(baseScore * sensorBoost * 10);

      // Estimate radius (spatial spread)
      let maxDist = 0;
      for (const event of cluster.events) {
        const dist = haversineKm({ lat: centroidLat, lng: centroidLng }, event);
        if (dist > maxDist) maxDist = dist;
      }
      const radiusMeters = Math.max(100, Math.min(1000, maxDist * 1000));

      hotspots.push({
        id: `hs-${idCounter++}`,
        lat: centroidLat,
        lng: centroidLng,
        locationName,
        dominantType,
        eventCount: cluster.events.length,
        severity: maxSeverity,
        avgConfidence,
        sensorAqi,
        score: finalScore,
        radiusMeters: Math.round(radiusMeters)
      });
    }

    // 5. Sort by score descending and assign ranks
    hotspots.sort((a, b) => b.score - a.score);
    hotspots.forEach((hs, i) => { hs.rank = i + 1; });

    return hotspots;
  }
}

export { HotspotEngine };
