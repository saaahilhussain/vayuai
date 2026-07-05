import { generateTweet, generateHistoricalBatch } from "../services/fakeData.js";
import { store, sensorGrid, broadcastEvent } from "../services/shared.js";
import { processTweet } from "./tweetController.js";

let simulationInterval = null;
let simulationSpeed = 8000;

export async function seedHistoricalData() {
  const historicalTweets = generateHistoricalBatch(80, 48);
  let seeded = 0;
  for (const tweet of historicalTweets) {
    const event = await processTweet(tweet);
    if (event) {
      const stored = store.add(event);
      sensorGrid.registerReport(stored.lat, stored.lng, stored.severityLevel || 1);
      seeded++;
    }
    // Small delay to avoid hammering the translation API
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`📊 Seeded ${seeded} historical events (${store.duplicatesMerged} duplicates merged)`);
}

export async function startSimulationFunc() {
  if (simulationInterval) return;
  simulationInterval = setInterval(async () => {
    const tweet = generateTweet();
    const event = await processTweet(tweet);
    if (event) {
      const stored = store.add(event);
      sensorGrid.registerReport(stored.lat, stored.lng, stored.severityLevel || 1);
      broadcastEvent(stored);
    }
  }, simulationSpeed);
  console.log(`▶️  Simulation started (interval: ${simulationSpeed}ms)`);
}

export function stopSimulationFunc() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("⏸️  Simulation paused");
  }
}

export async function simulateBatch(req, res) {
  const count = Math.min(parseInt(req.body?.count) || 10, 50);
  const events = [];
  for (let i = 0; i < count; i++) {
    const tweet = generateTweet();
    const event = await processTweet(tweet);
    if (event) {
      const stored = store.add(event);
      sensorGrid.registerReport(stored.lat, stored.lng, stored.severityLevel || 1);
      broadcastEvent(stored);
      events.push(stored);
    }
  }
  res.json({ generated: events.length, events });
}

export function startSimulationAPI(req, res) {
  simulationSpeed = Math.max(2000, parseInt(req.body?.interval) || 8000);
  stopSimulationFunc();
  startSimulationFunc();
  res.json({ status: "running", interval: simulationSpeed });
}

export function stopSimulationAPI(req, res) {
  stopSimulationFunc();
  res.json({ status: "stopped" });
}

export function getSimulationStatus(req, res) {
  res.json({ running: !!simulationInterval, interval: simulationSpeed });
}
