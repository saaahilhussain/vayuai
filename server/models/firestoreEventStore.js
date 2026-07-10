// Firestore-backed event store with in-memory cache for real-time performance.
// Keeps the same API surface as the original EventStore so controllers don't change.

import { adminDb } from "../config/firebaseAdmin.js";

const COLLECTION = "events";

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

/**
 * Strip fields that Firestore cannot store (undefined values, circular refs)
 * and remove large base64 data that shouldn't be persisted in Firestore.
 */
function sanitizeForFirestore(obj) {
  const cleaned = JSON.parse(JSON.stringify(obj));
  // Remove base64 image data — the Storage URL is in imageUrl
  delete cleaned.imageDataUrl;
  delete cleaned.videoFrames;
  // Remove firestoreId (internal tracking field)
  delete cleaned.firestoreId;
  return cleaned;
}

class FirestoreEventStore {
  constructor(maxEvents = 500) {
    this.events = [];          // in-memory cache for fast reads
    this.maxEvents = maxEvents;
    this.noiseFiltered = 0;
    this.duplicatesMerged = 0;
    this._ready = false;
  }

  /**
   * Load existing events from Firestore into the in-memory cache on startup.
   */
  async init() {
    try {
      const snapshot = await adminDb
        .collection(COLLECTION)
        .orderBy("timestamp", "asc")
        .limit(this.maxEvents)
        .get();

      this.events = snapshot.docs.map((doc) => ({ firestoreId: doc.id, ...doc.data() }));
      this._ready = true;
      console.log(`📦 Loaded ${this.events.length} events from Firestore`);
    } catch (err) {
      console.error("⚠️ Firestore init failed, starting with empty store:", err.message);
      this._ready = true;
    }
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
      if (age > windowMs) break;

      if (existing.pollutionType !== event.pollutionType) continue;
      if (!existing.lat || !existing.lng) continue;
      const dist = haversineKm(existing, event);
      if (dist > 0.5) continue;

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
   */
  mergeInto(existing, newEvent) {
    existing.corroborationCount = (existing.corroborationCount || 1) + 1;
    existing.corroboratedBy = existing.corroboratedBy || [existing.handle];
    if (newEvent.handle && !existing.corroboratedBy.includes(newEvent.handle)) {
      existing.corroboratedBy.push(newEvent.handle);
    }
    
    existing.corroboratingCitizenUids = existing.corroboratingCitizenUids || [];
    if (existing.citizenUid && !existing.corroboratingCitizenUids.includes(existing.citizenUid)) {
      existing.corroboratingCitizenUids.push(existing.citizenUid);
    }
    if (newEvent.citizenUid && !existing.corroboratingCitizenUids.includes(newEvent.citizenUid)) {
      existing.corroboratingCitizenUids.push(newEvent.citizenUid);
    }

    existing.lastCorroboratedAt = new Date().toISOString();

    const severityRank = { low: 1, moderate: 2, high: 3, critical: 4 };
    if ((severityRank[newEvent.severity] || 0) > (severityRank[existing.severity] || 0)) {
      existing.severity = newEvent.severity;
      existing.severityLevel = newEvent.severityLevel;
    }

    const n = existing.corroborationCount;
    existing.confidence = Math.min(
      1.0,
      existing.confidence * ((n - 1) / n) + (newEvent.confidence || 0) * (1 / n) + 0.05
    );

    if (newEvent.imageAnalysis?.available && !existing.imageAnalysis?.available) {
      existing.imageAnalysis = newEvent.imageAnalysis;
      existing.imageUrl = newEvent.imageUrl || existing.imageUrl;
    }

    this.duplicatesMerged++;

    // Update Firestore in background
    if (existing.firestoreId) {
      adminDb.collection(COLLECTION).doc(existing.firestoreId)
        .update(sanitizeForFirestore(existing))
        .catch((err) => console.error("Firestore merge update failed:", err.message));
    }

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

    // Add lifecycle fields for RBAC (Phase 4/5)
    event.status = event.status || "pending_review";  // pending_review | open | assigned | worker_en_route | reached | cleanup_done | resolved
    event.citizenUid = event.citizenUid || null;
    event.assignedTo = event.assignedTo || null;      // team/worker uid
    event.resolutionProofUrl = event.resolutionProofUrl || null;
    event.aiResolutionScore = event.aiResolutionScore || null;

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Write to Firestore in background
    const cleanEvent = sanitizeForFirestore(event);
    adminDb.collection(COLLECTION).add(cleanEvent)
      .then((docRef) => {
        event.firestoreId = docRef.id;
      })
      .catch((err) => console.error("Firestore add failed:", err.message));

    return event;
  }

  incrementNoiseFiltered() {
    this.noiseFiltered++;
  }

  getAll() {
    return this.events;
  }

  deleteEvent(id) {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx !== -1) {
      const event = this.events[idx];
      this.events.splice(idx, 1);
      
      if (event.firestoreId) {
        adminDb.collection(COLLECTION).doc(event.firestoreId)
          .delete()
          .catch((err) => console.error("Firestore delete failed:", err.message));
      }
      return true;
    }
    return false;
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
    const byStatus = { open: 0, in_progress: 0, resolved: 0 };

    for (const event of last24h) {
      byType[event.pollutionType] = (byType[event.pollutionType] || 0) + 1;
      if (event.state) {
        byState[event.state] = (byState[event.state] || 0) + 1;
      }
      if (bySeverity[event.severity] !== undefined) {
        bySeverity[event.severity]++;
      }
      const hour = new Date(event.timestamp).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;

      // Track lifecycle status
      const status = event.status || "open";
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

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
      byStatus,
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
    const bucketSize = 3600 * 1000;
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

  // --- New CRUD methods for Phase 4 (Municipality) ---

  async getCitizenEvents(citizenUid) {
    // Return from Firestore directly to bypass the 500 maxEvents limit in memory cache
    try {
      const snapshot = await adminDb
        .collection(COLLECTION)
        .where("citizenUid", "==", citizenUid)
        .get();
      
      const firestoreEvents = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
      
      // Also check corroboratingCitizenUids
      const corrobSnapshot = await adminDb
        .collection(COLLECTION)
        .where("corroboratingCitizenUids", "array-contains", citizenUid)
        .get();
        
      const corrobEvents = corrobSnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
      
      // Merge and deduplicate
      const allEvents = [...firestoreEvents, ...corrobEvents];
      const uniqueEvents = [];
      const seen = new Set();
      for (const e of allEvents) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          uniqueEvents.push(e);
        }
      }
      
      // Merge with any in-memory events that might not be fully synced yet
      const memoryEvents = this.events.filter(e => 
        e.citizenUid === citizenUid || 
        (e.corroboratingCitizenUids && e.corroboratingCitizenUids.includes(citizenUid))
      );
      
      for (const me of memoryEvents) {
        if (!seen.has(me.id)) {
          seen.add(me.id);
          uniqueEvents.push(me);
        } else {
          // Update uniqueEvents with memory event as it might be fresher
          const idx = uniqueEvents.findIndex(e => e.id === me.id);
          if (idx !== -1) uniqueEvents[idx] = me;
        }
      }

      return uniqueEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error("Error fetching citizen events from Firestore:", error);
      // Fallback to in-memory store
      return this.events.filter(e => 
        e.citizenUid === citizenUid || 
        (e.corroboratingCitizenUids && e.corroboratingCitizenUids.includes(citizenUid))
      ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  }

  getById(eventId) {
    return this.events.find((e) => e.id === eventId) || null;
  }

  async updateStatus(eventId, status, updatedBy) {
    const event = this.getById(eventId);
    if (!event) return null;

    event.status = status;
    event.lastUpdatedBy = updatedBy;
    event.lastUpdatedAt = new Date().toISOString();

    if (event.firestoreId) {
      await adminDb.collection(COLLECTION).doc(event.firestoreId).update({
        status,
        lastUpdatedBy: updatedBy,
        lastUpdatedAt: event.lastUpdatedAt,
      });
    }

    return event;
  }

  async updateEvent(eventId, updatedFields) {
    const event = this.getById(eventId);
    if (!event) return null;

    Object.assign(event, updatedFields);
    event.lastUpdatedAt = new Date().toISOString();

    if (event.firestoreId) {
      const dbPayload = { ...updatedFields, lastUpdatedAt: event.lastUpdatedAt };
      // Filter out undefined fields to avoid Firestore errors
      Object.keys(dbPayload).forEach(key => dbPayload[key] === undefined && delete dbPayload[key]);
      
      await adminDb.collection(COLLECTION).doc(event.firestoreId).update(dbPayload);
    }

    return event;
  }

  async assignWorker(eventId, workerUid, teamId) {
    const event = this.getById(eventId);
    if (!event) return null;

    event.assignedTo = workerUid;
    event.assignedTeamId = teamId || null;
    event.status = "in_progress";
    event.assignedAt = new Date().toISOString();

    if (event.firestoreId) {
      await adminDb.collection(COLLECTION).doc(event.firestoreId).update({
        assignedTo: workerUid,
        assignedTeamId: event.assignedTeamId,
        status: "in_progress",
        assignedAt: event.assignedAt,
      });
    }

    return event;
  }

  async resolveEvent(eventId, proofUrl, resolvedBy) {
    const event = this.getById(eventId);
    if (!event) return null;

    event.status = "resolved";
    event.resolutionProofUrl = proofUrl;
    event.resolvedBy = resolvedBy;
    event.resolvedAt = new Date().toISOString();

    if (event.firestoreId) {
      await adminDb.collection(COLLECTION).doc(event.firestoreId).update({
        status: "resolved",
        resolutionProofUrl: proofUrl,
        resolvedBy,
        resolvedAt: event.resolvedAt,
      });
    }

    return event;
  }

  async getByIdAsync(eventId) {
    let event = this.events.find((e) => e.id === eventId || e.firestoreId === eventId);
    if (event) return event;
    
    // Fallback to Firestore if not in memory cache
    try {
      // First try matching by our custom 'id' field
      let snapshot = await adminDb.collection(COLLECTION).where("id", "==", eventId).limit(1).get();
      if (!snapshot.empty) {
        return { firestoreId: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      }
      
      // Fallback: try fetching by Firestore document ID
      const docRef = await adminDb.collection(COLLECTION).doc(eventId).get();
      if (docRef.exists) {
        return { firestoreId: docRef.id, ...docRef.data() };
      }
    } catch (err) {
      console.error("Error fetching event by ID from Firestore:", err.message);
    }
    return null;
  }

  async deleteEvent(eventId) {
    // 1. Remove from memory cache if it exists
    const idx = this.events.findIndex((e) => e.id === eventId || e.firestoreId === eventId);
    if (idx !== -1) {
      this.events.splice(idx, 1);
    }

    // 2. Delete from Firestore
    try {
      let snapshot = await adminDb.collection(COLLECTION).where("id", "==", eventId).limit(1).get();
      if (!snapshot.empty) {
        await adminDb.collection(COLLECTION).doc(snapshot.docs[0].id).delete();
        return true;
      }
      
      // Fallback: try deleting by Firestore document ID
      await adminDb.collection(COLLECTION).doc(eventId).delete();
      return true;
    } catch (err) {
      console.error("Firestore delete failed:", err.message);
      return false;
    }
  }
}

export { FirestoreEventStore };
