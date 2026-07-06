import { FirestoreEventStore } from "../models/firestoreEventStore.js";
import { SensorGrid } from "./sensorGrid.js";

export const store = new FirestoreEventStore(500);
export const sensorGrid = new SensorGrid();
export const sseClients = [];

export function broadcastEvent(event) {
  sseClients.forEach((client) =>
    client.res.write(`data: ${JSON.stringify(event)}\n\n`)
  );
}
