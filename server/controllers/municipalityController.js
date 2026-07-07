import { store } from "../services/shared.js";
import { adminDb } from "../config/firebaseAdmin.js";

const USERS_COLLECTION = "users";

/**
 * GET /api/municipality/events — List all events with status filters
 */
export function listEvents(req, res) {
  const { status, severity, type } = req.query;
  let events = store.getAll();

  if (status) {
    events = events.filter((e) => (e.status || "open") === status);
  }
  if (severity) {
    events = events.filter((e) => e.severity === severity);
  }
  if (type) {
    events = events.filter((e) => e.pollutionType === type);
  }

  // Return newest first, with only essential fields to keep payload small
  const mapped = events
    .slice()
    .reverse()
    .map((e) => ({
      id: e.id,
      text: e.text,
      pollutionType: e.pollutionType,
      severity: e.severity,
      severityLevel: e.severityLevel,
      status: e.status || "open",
      locationName: e.locationName,
      lat: e.lat,
      lng: e.lng,
      timestamp: e.timestamp,
      assignedTo: e.assignedTo || null,
      assignedAt: e.assignedAt || null,
      resolvedAt: e.resolvedAt || null,
      resolutionProofUrl: e.resolutionProofUrl || null,
      corroborationCount: e.corroborationCount || 1,
      confidence: e.confidence,
      fusedConfidence: e.fusedConfidence,
      imageUrl: e.imageUrl || null,
      handle: e.handle,
      source: e.source,
    }));

  res.json({
    total: mapped.length,
    events: mapped,
  });
}

/**
 * PATCH /api/municipality/events/:id/status — Update event status
 */
export async function updateEventStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["open", "in_progress", "resolved", "spam"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
  }

  const event = await store.updateStatus(id, status, req.user.uid);
  if (!event) {
    return res.status(404).json({ error: "Event not found" });
  }

  res.json({ success: true, event });
}

/**
 * PATCH /api/municipality/events/:id/assign — Assign a worker to an event
 */
export async function assignWorker(req, res) {
  const { id } = req.params;
  const { workerUid } = req.body;

  if (!workerUid) {
    return res.status(400).json({ error: "workerUid is required" });
  }

  const event = await store.assignWorker(id, workerUid);
  if (!event) {
    return res.status(404).json({ error: "Event not found" });
  }

  res.json({ success: true, event });
}

/**
 * DELETE /api/municipality/events/:id — Delete (spam) event
 */
export async function deleteEvent(req, res) {
  const { id } = req.params;

  const deleted = await store.deleteEvent(id);
  if (!deleted) {
    return res.status(404).json({ error: "Event not found" });
  }

  res.json({ success: true, message: "Event deleted" });
}

/**
 * GET /api/municipality/workers — List all users with role "worker"
 */
export async function listWorkers(req, res) {
  try {
    const snapshot = await adminDb
      .collection(USERS_COLLECTION)
      .where("role", "==", "worker")
      .get();

    const workers = snapshot.docs.map((doc) => ({
      uid: doc.id,
      email: doc.data().email,
      name: doc.data().teamName || doc.data().name || doc.data().email, // Fallback for UI that still expects "name"
      teamName: doc.data().teamName || doc.data().name || "",
      workerName: doc.data().workerName || "",
      gender: doc.data().gender || "",
      teamStrength: doc.data().teamStrength || 1,
      govtId: doc.data().govtId || "",
      mobile: doc.data().mobile || "",
      officeAddress: doc.data().officeAddress || "",
      manualStatus: doc.data().manualStatus || null,
    }));

    res.json({ workers });
  } catch (err) {
    console.error("Error fetching workers:", err.message);
    res.json({ workers: [] });
  }
}

/**
 * PATCH /api/municipality/workers/:uid/status — Update worker manual status override
 */
export async function updateWorkerStatus(req, res) {
  const { uid } = req.params;
  const { status } = req.body;

  try {
    // We only support marking as 'idle' for now, or clearing it.
    // If status is 'clear', we delete the field.
    if (status === 'clear') {
      await adminDb.collection(USERS_COLLECTION).doc(uid).set({ manualStatus: null }, { merge: true });
    } else {
      await adminDb.collection(USERS_COLLECTION).doc(uid).set({ manualStatus: status }, { merge: true });
    }
    res.json({ success: true, status });
  } catch (err) {
    console.error("Error updating worker status:", err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/municipality/dashboard — Dashboard summary stats
 */
export function getDashboard(req, res) {
  const events = store.getAll();
  const now = Date.now();
  const last24h = events.filter(
    (e) => now - new Date(e.timestamp).getTime() < 24 * 3600 * 1000,
  );

  const byStatus = { pending_review: 0, open: 0, assigned: 0, worker_en_route: 0, reached: 0, cleanup_done: 0, resolved: 0 };
  const bySeverity = { critical: 0, high: 0, moderate: 0, low: 0 };
  const wardPerformance = {};
  let totalResponseTimeMs = 0;
  let resolvedCount = 0;

  for (const e of events) { // Compute over all events for Ward Performance
    const status = e.status || "pending_review";
    const ward = e.locationName || "Unknown";
    
    if (!wardPerformance[ward]) {
      wardPerformance[ward] = { total: 0, resolved: 0 };
    }
    wardPerformance[ward].total++;
    
    if (status === "resolved") {
      wardPerformance[ward].resolved++;
      
      if (e.resolvedAt && e.timestamp) {
        totalResponseTimeMs += (new Date(e.resolvedAt) - new Date(e.timestamp));
        resolvedCount++;
      }
    }
  }

  for (const e of last24h) {
    const status = e.status || "pending_review";
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (bySeverity[e.severity] !== undefined) {
      bySeverity[e.severity]++;
    }
  }

  let avgResponseTime = "N/A";
  if (resolvedCount > 0) {
    const avgMs = totalResponseTimeMs / resolvedCount;
    const avgHrs = (avgMs / (1000 * 60 * 60)).toFixed(1);
    avgResponseTime = `${avgHrs}h`;
  }

  res.json({
    total: events.length,
    last24h: last24h.length,
    byStatus,
    bySeverity,
    wardPerformance,
    avgResponseTime,
    criticalOpen: last24h.filter(
      (e) => e.severity === "critical" && (e.status || "pending_review") !== "resolved",
    ).length,
  });
}
