import { store } from "../services/shared.js";

export async function getCitizenEvents(req, res) {
  const citizenUid = req.user.uid;
  const events = await store.getCitizenEvents(citizenUid);

  const mapped = events.map((e) => ({
    id: e.id,
    reportId: e.reportId,
    text: e.text,
    pollutionType: e.pollutionType,
    severity: e.severity,
    status: e.status,
    locationName: e.locationName,
    timestamp: e.timestamp,
    imageUrl: e.imageUrl || null,
    feedback: e.feedback || null,
    resolutionProofUrl: e.resolutionProofUrl || null,
    citizenUid: e.citizenUid,
    corroboratingCitizenUids: e.corroboratingCitizenUids || [],
  }));

  res.json({ success: true, events: mapped });
}

export function addFeedback(req, res) {
  const { id } = req.params;
  const { rating } = req.body; // expected to be string/emoji

  const event = store.getAll().find((e) => e.id === id);
  if (!event) return res.status(404).json({ error: "Event not found" });

  if (event.citizenUid !== req.user.uid) {
    return res.status(403).json({ error: "Not authorized to give feedback for this event" });
  }

  if (event.status !== "resolved") {
    return res.status(400).json({ error: "Can only give feedback on resolved events" });
  }

  event.feedback = rating;

  res.json({ success: true, event });
}

export async function deleteCitizenEvent(req, res) {
  const { id } = req.params;
  const event = await store.getByIdAsync(id);
  if (!event) return res.status(404).json({ error: "Event not found" });

  if (event.citizenUid !== req.user.uid) {
    return res.status(403).json({ error: "Not authorized to delete this event" });
  }

  const success = await store.deleteEvent(id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Failed to delete event" });
  }
}
