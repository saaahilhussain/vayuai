import { store } from "../services/shared.js";
import { verifyResolutionImage } from "../services/imageAnalysis.js";

/**
 * GET /api/worker/assignments — List events assigned to the authenticated worker
 */
export function getAssignments(req, res) {
  const workerUid = req.user.uid;
  let events = store.getAll();

  // Filter only events assigned to this worker
  events = events.filter((e) => e.assignedTo === workerUid);

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
      corroborationCount: e.corroborationCount || 1,
      confidence: e.confidence,
      imageUrl: e.imageUrl || null,
      handle: e.handle,
    }));

  res.json({
    total: mapped.length,
    events: mapped,
  });
}

/**
 * PATCH /api/worker/events/:id/status — Worker updates status of their assigned event
 * Workers can only change: open → in_progress, in_progress → resolved
 */
export async function updateAssignmentStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const workerUid = req.user.uid;

  const validTransitions = {
    open: ["in_progress"],
    in_progress: ["resolved"],
  };

  // Check event exists and is assigned to this worker
  const allEvents = store.getAll();
  const event = allEvents.find((e) => e.id === id);

  if (!event) {
    return res.status(404).json({ error: "Event not found" });
  }

  if (event.assignedTo !== workerUid) {
    return res.status(403).json({ error: "This event is not assigned to you" });
  }

  const currentStatus = event.status || "open";
  const allowed = validTransitions[currentStatus];

  if (!allowed || !allowed.includes(status)) {
    return res.status(400).json({
      error: `Cannot transition from '${currentStatus}' to '${status}'. Allowed: ${(allowed || []).join(", ") || "none"}`,
    });
  }

  const updated = await store.updateStatus(id, status, workerUid);
  if (!updated) {
    return res.status(404).json({ error: "Event not found" });
  }

  res.json({ success: true, event: updated });
}

/**
 * POST /api/worker/events/:id/verify — Worker uploads after-photo for verification
 */
export async function verifyEvent(req, res) {
  const { id } = req.params;
  const { imageDataUrl, note } = req.body;
  const workerUid = req.user.uid;

  if (!imageDataUrl) {
    return res.status(400).json({ error: "Missing imageDataUrl" });
  }

  const allEvents = store.getAll();
  const event = allEvents.find((e) => e.id === id);

  if (!event) {
    return res.status(404).json({ error: "Event not found" });
  }

  if (event.assignedTo !== workerUid) {
    return res.status(403).json({ error: "This event is not assigned to you" });
  }

  const result = await verifyResolutionImage(event.text || "No description", event.pollutionType, imageDataUrl);
  if (!result.available || result.error) {
    return res.status(500).json({ error: "AI Verification failed", details: result.error });
  }

  const updatedFields = {
    status: "cleanup_done",
    resolutionProofUrl: imageDataUrl,
    aiResolutionScore: result.resolutionScore,
    resolutionNote: note,
  };

  const updated = await store.updateEvent(id, updatedFields);
  if (!updated) {
    return res.status(404).json({ error: "Event not found during update" });
  }

  res.json({ success: true, verification: result, event: updated });
}
