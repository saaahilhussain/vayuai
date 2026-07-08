import { store, sseClients } from "../services/shared.js";
import { LOCATIONS } from "../services/geocoder.js";

function stripPrivate(events) {
  return events.map(e => {
    const pub = { ...e };
    delete pub.reportId;
    return pub;
  });
}

export function getEvents(req, res) {
  const { start, end } = req.query;
  if (start && end) {
    res.json(stripPrivate(store.getByTimeRange(Number(start), Number(end))));
  } else {
    res.json(stripPrivate(store.getAll()));
  }
}

export function getRecentEvents(req, res) {
  const count = parseInt(req.query.count) || 50;
  res.json(stripPrivate(store.getRecent(count)));
}

export function getFilteredEvents(req, res) {
  const minRelevancy = parseFloat(req.query.minRelevancy) || 0.4;
  const events = store.getAll().filter((e) => (e.relevancyScore || 0) >= minRelevancy);
  res.json(stripPrivate(events));
}

export function getHeatmap(req, res) {
  const { start, end } = req.query;
  res.json(store.getHeatmapData(start ? Number(start) : null, end ? Number(end) : null));
}

export function getLocations(req, res) {
  res.json(
    Object.keys(LOCATIONS).map((loc) =>
      loc.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    )
  );
}

export function streamEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  sseClients.push(res);
  req.on("close", () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
}
