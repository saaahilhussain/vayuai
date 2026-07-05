// In-memory event store with aggregation methods

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
 * Simple token-overlap similarity (0–1).
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

class EventStore {
  constructor(maxEvents = 500) {
    this.events = [];
    this.maxEvents = maxEvents;
    this.noiseFiltered = 0;
    this.duplicatesMerged = 0;
  }

  /**
   * Find a recent duplicate event based on:
   * - Same pollutionType
   * - Geographic proximity (< 0.5 km)
   * - Text similarity (token overlap > 0.35) OR same location name
   */
  findDuplicate(event, windowMs = 30 * 60 * 1000) {
    if (!event.lat || !event.lng) return null;
    const now = Date.now();

    for (let i = this.events.length - 1; i >= 0; i--) {
      const existing = this.events[i];
      const age = now - new Date(existing.timestamp).getTime();
      if (age > windowMs) break; // events are chronological

      // Must be same pollution type
      if (existing.pollutionType !== event.pollutionType) continue;

      // Geographic proximity check
      if (!existing.lat || !existing.lng) continue;
      const dist = haversineKm(existing, event);
      if (dist > 0.5) continue;

      // Text similarity OR same location
      const textSim = textSimilarity(existing.text, event.text);
      const sameLocation =
        existing.locationName &&
        event.locationName &&
        existing.locationName.toLowerCase() === event.locationName.toLowerCase();

      if (textSim > 0.35 || sameLocation) {
        return existing;
      }
    }
    return null;
  }

  /**
   * Merge a new event into an existing duplicate.
   * Updates corroboration count, confidence, severity, and source tracking.
   */
  mergeInto(existing, newEvent) {
    existing.corroborationCount = (existing.corroborationCount || 1) + 1;
    existing.corroboratedBy = existing.corroboratedBy || [existing.handle];
    if (newEvent.handle && !existing.corroboratedBy.includes(newEvent.handle)) {
      existing.corroboratedBy.push(newEvent.handle);
    }
    existing.lastCorroboratedAt = new Date().toISOString();

    // Upgrade severity if new report is higher
    const severityRank = { low: 1, moderate: 2, high: 3, critical: 4 };
    if ((severityRank[newEvent.severity] || 0) > (severityRank[existing.severity] || 0)) {
      existing.severity = newEvent.severity;
      existing.severityLevel = newEvent.severityLevel;
    }

    // Weighted confidence merge: existing gets more weight as corroboration grows
    const n = existing.corroborationCount;
    existing.confidence = Math.min(
      1.0,
      existing.confidence * ((n - 1) / n) + (newEvent.confidence || 0) * (1 / n) + 0.05
    );

    // If the new event has image analysis and existing doesn't, adopt it
    if (newEvent.imageAnalysis?.available && !existing.imageAnalysis?.available) {
      existing.imageAnalysis = newEvent.imageAnalysis;
      existing.imageUrl = newEvent.imageUrl || existing.imageUrl;
    }

    this.duplicatesMerged++;
    return existing;
  }

  add(event) {
    // Check for duplicates first
    const duplicate = this.findDuplicate(event);
    if (duplicate) {
      this.mergeInto(duplicate, event);
      return duplicate;
    }

    // Initialize corroboration fields
    event.corroborationCount = 1;
    event.corroboratedBy = [event.handle];

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    return event;
  }

  incrementNoiseFiltered() {
    this.noiseFiltered++;
  }

  getAll() {
    return this.events;
  }

  getRecent(count = 50) {
    return this.events.slice(-count);
  }

  getByTimeRange(startTime, endTime) {
    return this.events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= startTime && t <= endTime;
    });
  }

  /**
   * Get recent events from a specific location (for corroboration)
   * @param {string} locationName
   * @param {number} windowMs - time window in ms (default 30 min)
   */
  getRecentByLocation(locationName, windowMs = 30 * 60 * 1000) {
    if (!locationName) return [];
    const now = Date.now();
    const lowerLoc = locationName.toLowerCase();
    return this.events.filter((e) => {
      const age = now - new Date(e.timestamp).getTime();
      if (age > windowMs) return false;
      const eventLoc = (e.locationName || "").toLowerCase();
      return eventLoc === lowerLoc || (e.locations || []).some((l) => l.toLowerCase() === lowerLoc);
    });
  }

  getStats() {
    const now = Date.now();
    const last24h = this.events.filter(
      (e) => now - new Date(e.timestamp).getTime() < 24 * 3600 * 1000,
    );

    const byType = {};
    const byState = {};
    const bySeverity = { critical: 0, high: 0, moderate: 0, low: 0 };
    const byHour = {};

    for (const event of last24h) {
      // By type
      byType[event.pollutionType] = (byType[event.pollutionType] || 0) + 1;
      // By state
      if (event.state) {
        byState[event.state] = (byState[event.state] || 0) + 1;
      }
      // By severity
      if (bySeverity[event.severity] !== undefined) {
        bySeverity[event.severity]++;
      }
      // By hour
      const hour = new Date(event.timestamp).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    }

    // Most affected district
    const locationCounts = {};
    for (const event of last24h) {
      if (event.locationName) {
        locationCounts[event.locationName] =
          (locationCounts[event.locationName] || 0) + 1;
      }
    }
    const mostAffected = Object.entries(locationCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];

    return {
      total: this.events.length,
      last24h: last24h.length,
      noiseFiltered: this.noiseFiltered,
      duplicatesMerged: this.duplicatesMerged,
      byType,
      byState,
      bySeverity,
      byHour,
      mostAffected: mostAffected
        ? { name: mostAffected[0], count: mostAffected[1] }
        : null,
      totalAffectedPeople: last24h.reduce(
        (sum, e) => sum + (e.affectedCount || 0),
        0,
      ),
    };
  }

  getTrendData(hours = 48) {
    const now = Date.now();
    const bucketSize = 3600 * 1000; // 1 hour
    const buckets = [];

    for (let i = hours; i >= 0; i--) {
      const bucketStart = now - i * bucketSize;
      const bucketEnd = bucketStart + bucketSize;
      const events = this.events.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t >= bucketStart && t < bucketEnd;
      });

      const types = {};
      for (const e of events) {
        types[e.pollutionType] = (types[e.pollutionType] || 0) + 1;
      }

      buckets.push({
        time: new Date(bucketStart).toISOString(),
        hour: new Date(bucketStart).getHours(),
        total: events.length,
        garbage_burning: types.garbage_burning || 0,
        industrial_smoke: types.industrial_smoke || 0,
        vehicle_pollution: types.vehicle_pollution || 0,
        construction_dust: types.construction_dust || 0,
        garbage_dumping: types.garbage_dumping || 0,
        smog: types.smog || 0,
      });
    }

    return buckets;
  }

  getHeatmapData(startTime = null, endTime = null) {
    let filtered = this.events;
    if (startTime && endTime) {
      filtered = this.getByTimeRange(startTime, endTime);
    }
    return filtered
      .filter((e) => e.lat && e.lng)
      .map((e) => ({
        lat: e.lat,
        lng: e.lng,
        intensity: e.severityLevel / 4,
      }));
  }
}

export { EventStore };

