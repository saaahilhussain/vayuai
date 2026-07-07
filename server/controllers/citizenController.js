import { store } from "../services/shared.js";

export function getCitizenEvents(req, res) {
  const citizenUid = req.user.uid;
  let events = store.getAll();
  events = events.filter((e) => e.citizenUid === citizenUid);

  const mapped = events.reverse().map((e) => ({
    id: e.id,
    text: e.text,
    pollutionType: e.pollutionType,
    severity: e.severity,
    status: e.status,
    locationName: e.locationName,
    timestamp: e.timestamp,
    imageUrl: e.imageUrl || null,
    feedback: e.feedback || null,
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

export function deleteCitizenEvent(req, res) {
  const { id } = req.params;
  const event = store.getAll().find((e) => e.id === id);
  if (!event) return res.status(404).json({ error: "Event not found" });

  if (event.citizenUid !== req.user.uid) {
    return res.status(403).json({ error: "Not authorized to delete this event" });
  }

  const success = store.deleteEvent(id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Failed to delete event" });
  }
}
