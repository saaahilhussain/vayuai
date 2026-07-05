// Pre-built dictionary of Guwahati localities with coordinates
// Covers markets, residential areas, industrial zones, the Boragaon
// landfill, highway corridors, and river-adjacent wards
// (keys must stay in sync with server/nlpPipeline.js LOCATION_NAMES)

const LOCATIONS = {
  // ============= CENTRAL GUWAHATI =============
  "paltan bazaar": { lat: 26.1815, lng: 91.7443, state: "Central Guwahati", type: "market" },
  "fancy bazaar": { lat: 26.1839, lng: 91.7365, state: "Central Guwahati", type: "market" },
  "pan bazaar": { lat: 26.1872, lng: 91.7441, state: "Central Guwahati", type: "market" },
  "uzan bazar": { lat: 26.1918, lng: 91.7520, state: "Central Guwahati", type: "locality" },
  "guwahati club": { lat: 26.1843, lng: 91.7554, state: "Central Guwahati", type: "junction" },
  silpukhuri: { lat: 26.1880, lng: 91.7580, state: "Central Guwahati", type: "locality" },
  chandmari: { lat: 26.1862, lng: 91.7651, state: "Central Guwahati", type: "locality" },
  ulubari: { lat: 26.1740, lng: 91.7551, state: "Central Guwahati", type: "junction" },
  "lachit nagar": { lat: 26.1701, lng: 91.7601, state: "Central Guwahati", type: "locality" },
  rehabari: { lat: 26.1750, lng: 91.7450, state: "Central Guwahati", type: "locality" },
  athgaon: { lat: 26.1800, lng: 91.7350, state: "Central Guwahati", type: "locality" },
  kumarpara: { lat: 26.1780, lng: 91.7400, state: "Central Guwahati", type: "locality" },
  bharalumukh: { lat: 26.1780, lng: 91.7250, state: "Central Guwahati", type: "locality" },
  santipur: { lat: 26.1830, lng: 91.7300, state: "Central Guwahati", type: "locality" },
  "fatasil ambari": { lat: 26.1680, lng: 91.7270, state: "Central Guwahati", type: "locality" },
  "anil nagar": { lat: 26.1680, lng: 91.7620, state: "Central Guwahati", type: "locality" },
  "nabin nagar": { lat: 26.1700, lng: 91.7650, state: "Central Guwahati", type: "locality" },

  // ============= EAST GUWAHATI =============
  noonmati: { lat: 26.1830, lng: 91.7920, state: "East Guwahati", type: "industrial" }, // refinery
  bamunimaidan: { lat: 26.1830, lng: 91.7770, state: "East Guwahati", type: "industrial" },
  narengi: { lat: 26.1760, lng: 91.8080, state: "East Guwahati", type: "locality" },
  geetanagar: { lat: 26.1800, lng: 91.7830, state: "East Guwahati", type: "locality" },
  "zoo road": { lat: 26.1750, lng: 91.7720, state: "East Guwahati", type: "junction" },
  "zoo tiniali": { lat: 26.1755, lng: 91.7725, state: "East Guwahati", type: "junction" },

  // ============= SOUTH / SOUTH-EAST GUWAHATI =============
  bhangagarh: { lat: 26.1650, lng: 91.7660, state: "South Guwahati", type: "junction" },
  "christian basti": { lat: 26.1610, lng: 91.7740, state: "South Guwahati", type: "locality" },
  ganeshguri: { lat: 26.1550, lng: 91.7860, state: "South Guwahati", type: "junction" },
  dispur: { lat: 26.1430, lng: 91.7900, state: "South Guwahati", type: "locality" },
  "six mile": { lat: 26.1350, lng: 91.8000, state: "South Guwahati", type: "junction" },
  panjabari: { lat: 26.1320, lng: 91.8080, state: "South Guwahati", type: "locality" },
  khanapara: { lat: 26.1230, lng: 91.8160, state: "South Guwahati", type: "junction" },
  beltola: { lat: 26.1320, lng: 91.7890, state: "South Guwahati", type: "locality" },
  bhetapara: { lat: 26.1220, lng: 91.7820, state: "South Guwahati", type: "locality" },
  hatigaon: { lat: 26.1350, lng: 91.7800, state: "South Guwahati", type: "locality" },
  kahilipara: { lat: 26.1500, lng: 91.7700, state: "South Guwahati", type: "locality" },
  rukminigaon: { lat: 26.1400, lng: 91.7950, state: "South Guwahati", type: "locality" },
  "gs road": { lat: 26.1600, lng: 91.7750, state: "South Guwahati", type: "highway" },
  "vip road": { lat: 26.1500, lng: 91.8000, state: "South Guwahati", type: "highway" },
  basistha: { lat: 26.1050, lng: 91.7800, state: "South Guwahati", type: "locality" },
  sawkuchi: { lat: 26.1150, lng: 91.7600, state: "South Guwahati", type: "locality" },
  lokhra: { lat: 26.1050, lng: 91.7350, state: "South Guwahati", type: "locality" },
  gorchuk: { lat: 26.1150, lng: 91.7000, state: "South Guwahati", type: "junction" },

  // ============= WEST GUWAHATI =============
  boragaon: { lat: 26.1150, lng: 91.6850, state: "West Guwahati", type: "dumpsite" }, // landfill
  jalukbari: { lat: 26.1550, lng: 91.6650, state: "West Guwahati", type: "junction" },
  adabari: { lat: 26.1650, lng: 91.6780, state: "West Guwahati", type: "locality" },
  maligaon: { lat: 26.1650, lng: 91.6900, state: "West Guwahati", type: "locality" },
  pandu: { lat: 26.1720, lng: 91.6700, state: "West Guwahati", type: "industrial" }, // port
  kamakhya: { lat: 26.1660, lng: 91.7050, state: "West Guwahati", type: "locality" },
  azara: { lat: 26.1200, lng: 91.6100, state: "West Guwahati", type: "locality" },
  borjhar: { lat: 26.1050, lng: 91.5850, state: "West Guwahati", type: "locality" }, // airport area

  // ============= NORTH BANK =============
  amingaon: { lat: 26.1850, lng: 91.6600, state: "North Guwahati", type: "industrial" },
  "north guwahati": { lat: 26.2000, lng: 91.7200, state: "North Guwahati", type: "locality" },

  // ============= CITY-LEVEL =============
  guwahati: { lat: 26.1500, lng: 91.7500, state: "Guwahati", type: "city" },
};

// Zone centroids as fallback
const STATE_CENTROIDS = {
  "central guwahati": { lat: 26.1810, lng: 91.7480 },
  "east guwahati": { lat: 26.1790, lng: 91.7880 },
  "south guwahati": { lat: 26.1350, lng: 91.7880 },
  "west guwahati": { lat: 26.1450, lng: 91.6750 },
  "north guwahati": { lat: 26.1950, lng: 91.7000 },
  guwahati: { lat: 26.1500, lng: 91.7500 },
  assam: { lat: 26.1500, lng: 91.7500 },
};

/**
 * Geocode a location string to lat/lng coordinates
 * @param {string} locationName - Name of the location
 * @returns {{ lat: number, lng: number, state: string, type: string, confidence: number } | null}
 */
function geocode(locationName) {
  if (!locationName) return null;

  const normalized = locationName.toLowerCase().trim();

  // Direct match
  if (LOCATIONS[normalized]) {
    return {
      ...LOCATIONS[normalized],
      confidence: 1.0,
      matchedName: normalized,
    };
  }

  // Partial match — check if any known location is contained in the input
  for (const [key, value] of Object.entries(LOCATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { ...value, confidence: 0.8, matchedName: key };
    }
  }

  // Zone-level fallback
  for (const [key, value] of Object.entries(STATE_CENTROIDS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        ...value,
        state: key,
        type: "zone",
        confidence: 0.5,
        matchedName: key,
      };
    }
  }

  return null;
}

/**
 * Geocode multiple location names and return the best match
 * @param {string[]} locations
 * @returns {object | null}
 */
function geocodeBest(locations) {
  if (!locations || locations.length === 0) return null;

  let best = null;
  for (const loc of locations) {
    const result = geocode(loc);
    if (result && (!best || result.confidence > best.confidence)) {
      best = result;
    }
  }
  return best;
}

function isWithinGuwahatiBounds(lat, lng) {
  return lat >= 25.95 && lat <= 26.35 && lng >= 91.45 && lng <= 92.05;
}

function distanceKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function nearestLocation(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isWithinGuwahatiBounds(lat, lng)) return null;

  const point = { lat, lng };
  let best = null;
  for (const [name, value] of Object.entries(LOCATIONS)) {
    const distance = distanceKm(point, value);
    if (!best || distance < best.distanceKm) {
      best = {
        ...value,
        matchedName: name,
        confidence: distance <= 1 ? 0.95 : 0.7,
        distanceKm: distance,
      };
    }
  }
  return best;
}

/**
 * Add slight randomness to coordinates for visual separation on map
 * (±0.003° ≈ 330 m — tuned for city-scale zoom)
 */
function jitter(coord, amount = 0.003) {
  return coord + (Math.random() - 0.5) * amount;
}

export {
  geocode,
  geocodeBest,
  jitter,
  nearestLocation,
  isWithinGuwahatiBounds,
  LOCATIONS,
  STATE_CENTROIDS,
};
