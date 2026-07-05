// NLP Pipeline — Rule-based NER + Pollution Classification
// Extracts: LOCATION, POLLUTION_TYPE, SEVERITY, AFFECTED_COUNT

const POLLUTION_KEYWORDS = {
  garbage_burning: {
    keywords: [
      "garbage fire",
      "garbage burning",
      "burning garbage",
      "burning waste",
      "waste burning",
      "trash fire",
      "burning trash",
      "plastic burning",
      "burning plastic",
      "dump fire",
      "dumpyard fire",
      "dump yard fire",
      "landfill fire",
      "landfill burning",
      "open burning",
      "burning rubbish",
      "garbage on fire",
      "garbage set on fire",
      "burning leaves",
      "burning tyres",
      "burning tires",
      "tyre burning",
      "tire burning",
      "smell of burning",
      "burning smell",
      "someone burning",
      "fire at the dump",
      "waste on fire",
      // Common romanized Assamese/Hindi/Bengali phrases
      "aborjona puri",
      "jabor puri",
      "kachra jal",
      "kachra jala",
      "kooda jala",
      "puriche",
    ],
    weight: 1.0,
  },
  industrial_smoke: {
    keywords: [
      "factory smoke",
      "chimney",
      "industrial smoke",
      "industrial emission",
      "industrial fumes",
      "industrial pollution",
      "factory fumes",
      "factory pollution",
      "refinery",
      "smokestack",
      "flue gas",
      "chemical smell",
      "chemical fumes",
      "chemical odour",
      "chemical odor",
      "gas leak",
      "sulphur smell",
      "sulfur smell",
      "brick kiln",
      "kiln smoke",
      "effluent",
      "emission from factory",
      "smoke from the plant",
      "plant emission",
    ],
    weight: 1.0,
  },
  vehicle_pollution: {
    keywords: [
      "vehicle smoke",
      "vehicle emission",
      "vehicular pollution",
      "exhaust fumes",
      "exhaust smoke",
      "diesel smoke",
      "diesel fumes",
      "traffic fumes",
      "traffic pollution",
      "traffic smoke",
      "smoke from bus",
      "smoke from truck",
      "smoke from buses",
      "smoke from trucks",
      "black smoke from",
      "auto exhaust",
      "tailpipe",
      "puc expired",
      "puc check",
      "old buses",
      "smoke belching",
      "traffic jam smoke",
      "gaadi ka dhuan",
      "gari dhuan",
    ],
    weight: 0.9,
  },
  construction_dust: {
    keywords: [
      "construction dust",
      "demolition dust",
      "demolition",
      "dust cloud",
      "dust everywhere",
      "dust from construction",
      "dust from the site",
      "cement dust",
      "sand dust",
      "stone crusher",
      "dust pollution",
      "dusty road",
      "road dust",
      "dust flying",
      "dust rising",
      "covered in dust",
      "construction site",
      "uncovered trucks",
      "sand trucks",
      "flyover construction",
      "dhuli",
      "dhulo",
      "dhool",
      "mitti udd",
    ],
    weight: 0.9,
  },
  garbage_dumping: {
    keywords: [
      "illegal dumping",
      "illegally dumped",
      "garbage pile",
      "garbage dump",
      "garbage heap",
      "waste dumped",
      "dumping waste",
      "dumping garbage",
      "rotting garbage",
      "rotting waste",
      "stench",
      "foul smell",
      "garbage everywhere",
      "garbage not collected",
      "garbage lying",
      "overflowing dustbin",
      "overflowing garbage",
      "garbage overflow",
      "litter",
      "littering",
      "medical waste",
      "waste pile",
      "open drain garbage",
      "durgondho",
      "pocha gondho",
      "gondho",
    ],
    weight: 0.8,
  },
  smog: {
    keywords: [
      "smog",
      "haze",
      "hazy",
      "air quality",
      "aqi",
      "pm2.5",
      "pm10",
      "pollution level",
      "air pollution",
      "polluted air",
      "toxic air",
      "choking air",
      "unbreathable",
      "air is heavy",
      "heavy air",
      "smoke everywhere",
      "smoky air",
      "low visibility",
      "visibility low",
      "grey sky",
      "gray sky",
      "can't breathe outside",
      "difficult to breathe",
      "hard to breathe",
      "dhuan",
      "dhuma",
      "kuwali",
      "saans nahi",
      "saans lene",
      "xah loba",
    ],
    weight: 1.0,
  },
};

const SEVERITY_INDICATORS = {
  critical: {
    keywords: [
      "can't breathe",
      "cannot breathe",
      "unable to breathe",
      "choking",
      "suffocating",
      "suffocation",
      "hospitalised",
      "hospitalized",
      "asthma attack",
      "children coughing",
      "children are coughing",
      "kids coughing",
      "toxic fumes",
      "toxic smoke",
      "poisonous",
      "hazardous",
      "massive fire",
      "huge fire",
      "emergency",
      "SOS",
      "evacuate",
      "evacuation",
      "eyes burning badly",
      "collapsed",
      "fainted",
      "critical",
      "life threatening",
      "worst ever",
      "unbearable",
    ],
    level: 4,
    label: "critical",
  },
  high: {
    keywords: [
      "thick smoke",
      "black smoke",
      "dense smoke",
      "thick black",
      "spreading",
      "spreading fast",
      "strong chemical smell",
      "burning eyes",
      "eyes watering",
      "throat irritation",
      "throat burning",
      "visibility very low",
      "can't see",
      "cannot see",
      "whole area covered",
      "entire area",
      "continuous burning",
      "burning since",
      "severe",
      "major",
      "serious",
      "dangerous",
      "massive",
      "widespread",
      "acrid",
      "headache",
      "dizzy",
      "nausea",
    ],
    level: 3,
    label: "high",
  },
  moderate: {
    keywords: [
      "smoky",
      "hazy",
      "dusty",
      "bad smell",
      "foul smell",
      "cough",
      "coughing",
      "irritating",
      "smell of burning",
      "burning smell",
      "air feels heavy",
      "alert",
      "warning",
      "rising",
      "increasing",
      "getting worse",
      "several",
      "multiple",
      "concern",
      "uncomfortable",
      "stench",
    ],
    level: 2,
    label: "moderate",
  },
  low: {
    keywords: [
      "slight haze",
      "mild smell",
      "little smoke",
      "some dust",
      "some smoke",
      "occasional",
      "minor",
      "slight",
      "small",
      "partial",
      "brief",
      "isolated",
      "localized",
      "monitoring",
      "watch",
    ],
    level: 1,
    label: "low",
  },
};

// Known Guwahati locality names for entity extraction
// (must stay in sync with server/geocoder.js LOCATIONS keys)
const LOCATION_NAMES = [
  // Central Guwahati
  "paltan bazaar",
  "fancy bazaar",
  "pan bazaar",
  "uzan bazar",
  "guwahati club",
  "silpukhuri",
  "chandmari",
  "ulubari",
  "lachit nagar",
  "rehabari",
  "athgaon",
  "kumarpara",
  "bharalumukh",
  "santipur",
  "fatasil ambari",
  "anil nagar",
  "nabin nagar",
  // East Guwahati
  "noonmati",
  "bamunimaidan",
  "narengi",
  "geetanagar",
  "zoo road",
  "zoo tiniali",
  "silpukhuri",
  // South / South-East Guwahati
  "bhangagarh",
  "christian basti",
  "ganeshguri",
  "dispur",
  "six mile",
  "panjabari",
  "khanapara",
  "beltola",
  "bhetapara",
  "hatigaon",
  "kahilipara",
  "rukminigaon",
  "gs road",
  "vip road",
  "basistha",
  "sawkuchi",
  "lokhra",
  "gorchuk",
  // West Guwahati
  "boragaon",
  "jalukbari",
  "adabari",
  "maligaon",
  "pandu",
  "kamakhya",
  "azara",
  "borjhar",
  // North bank
  "amingaon",
  "north guwahati",
  // City-level
  "guwahati",
];

/**
 * Extract locations mentioned in text
 */
function extractLocations(text) {
  const lowerText = text.toLowerCase();
  const found = [];

  // Sort by length descending to match longer names first (e.g., "north guwahati" before "guwahati")
  const sortedLocations = [...LOCATION_NAMES].sort(
    (a, b) => b.length - a.length,
  );

  for (const loc of sortedLocations) {
    if (lowerText.includes(loc)) {
      // Avoid duplicate entries from overlapping matches
      const alreadyFound = found.some(
        (f) => f.includes(loc) || loc.includes(f),
      );
      if (!alreadyFound) {
        found.push(loc);
      }
    }
  }

  return found;
}

/**
 * Classify pollution type from text
 */
function classifyPollution(text) {
  const lowerText = text.toLowerCase();
  let bestType = "other";
  let bestScore = 0;

  for (const [type, config] of Object.entries(POLLUTION_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of config.keywords) {
      if (lowerText.includes(keyword)) {
        matchCount++;
      }
    }
    const score = matchCount * config.weight;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return { type: bestType, score: bestScore };
}

/**
 * Determine severity level
 */
function assessSeverity(text) {
  const lowerText = text.toLowerCase();
  let maxLevel = 1;
  let label = "low";

  for (const [, config] of Object.entries(SEVERITY_INDICATORS)) {
    for (const keyword of config.keywords) {
      if (lowerText.includes(keyword.toLowerCase()) && config.level > maxLevel) {
        maxLevel = config.level;
        label = config.label;
      }
    }
  }

  return { level: maxLevel, label };
}

/**
 * Extract affected counts (people, houses, etc.)
 */
function extractAffectedCount(text) {
  const patterns = [
    /(\d[\d,]*)\s*(?:people|persons|families|residents|students|patients|workers)/gi,
    /(\d[\d,]*)\s*(?:houses|homes|buildings|shops|schools)/gi,
    /(\d[\d,]*)\s*(?:hospitalised|hospitalized|sick|ill|affected|coughing|admitted)/gi,
    /over\s+(\d[\d,]*)/gi,
    /more\s+than\s+(\d[\d,]*)/gi,
    /at\s+least\s+(\d[\d,]*)/gi,
  ];

  const counts = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      counts.push(parseInt(match[1].replace(/,/g, ""), 10));
    }
  }

  return counts.length > 0 ? Math.max(...counts) : null;
}

/**
 * Calculate confidence score for the NER extraction
 */
function calculateConfidence(locations, pollutionScore, severity) {
  let confidence = 0;

  // Location found adds 0.3
  if (locations.length > 0) confidence += 0.3;
  if (locations.length > 1) confidence += 0.1;

  // Pollution keyword matches
  if (pollutionScore >= 3) confidence += 0.3;
  else if (pollutionScore >= 2) confidence += 0.25;
  else if (pollutionScore >= 1) confidence += 0.15;

  // Higher severity adds more confidence
  confidence += severity.level * 0.05;

  return Math.min(confidence, 1.0);
}

/**
 * ============================================================
 * RELEVANCY ENGINE — Multi-Signal Noise vs Real Detection
 * ============================================================
 *
 * 5 signals combined with weights:
 *   Text Quality (0.35) + Source Credibility (0.20) +
 *   Engagement (0.10) + Temporal Coherence (0.15) +
 *   Cross-Reference (0.20)
 *
 * Research basis:
 *   - Castillo et al. (2011): Content features strongest discriminator
 *   - Imran et al. (2015): Textual features most predictive for relevance
 *   - Geospatial clustering studies: Corroboration is gold standard for verification
 *   - Engagement is gameable by bots and penalizes breaking first reports
 */

const RELEVANCY_WEIGHTS = {
  textQuality: 0.35,       // ↑ Most predictive signal (Imran 2015, Castillo 2011)
  sourceCredibility: 0.20, // ↓ Avoid penalizing grassroots citizen reporters
  engagement: 0.10,        // ↓↓ Gameable by bots, penalizes breaking first reports
  temporalCoherence: 0.15, // = Clean binary signal, appropriately weighted
  crossReference: 0.20,    // ↑↑ Gold standard verification (spatiotemporal clustering)
};

// --- Signal 1: Text Quality Analysis ---

const WITNESS_PHRASES = [
  "i can see", "i am seeing", "just saw", "right now",
  "happening now", "i'm here", "we are stuck", "our locality",
  "my family", "my house", "we can smell", "looking at",
  "just witnessed", "before my eyes", "live from",
  "i'm reporting", "on the ground", "first hand",
  "outside my window", "in front of",
];

const SPECIFICITY_PATTERNS = [
  /\d+\s*(people|persons|families|houses|km|meters|feet|shops|schools)/i,
  /NH-?\d+/i,
  /\d+\s*(hospitalised|hospitalized|sick|admitted|coughing|affected)/i,
  /(district|block|circle|ward|colony|road|highway|lane|market|junction|flyover)\b/i,
  /\b(CPCB|PCBA|PCB|SPCB|GMC|GMDA|NGT|Pollution Control|Municipal Corporation)\b/i,
  /\b(aqi|pm\s?2\.5|pm\s?10)\s*(is|at|crossed|above|near|of)?\s*\d+/i,
  /(since|for the last|for past)\s*\d+\s*(hours|days|weeks)/i,
];

const NOISE_INDICATORS = {
  sarcasm: {
    patterns: [
      /\b(lol|lmao|rofl|haha|😂|🤣|jk|smh)\b/i,
      /\b(sarcasm|just kidding|not really)\b/i,
    ],
    penalty: -0.30,
  },
  pastReference: {
    patterns: [
      /\b(remember|throwback|back in \d{4}|last year|years ago|old photo|old video)\b/i,
      /\b(reminds me|nostalgia|looking back|anniversary of|last diwali)\b/i,
    ],
    penalty: -0.25,
  },
  hypothetical: {
    patterns: [
      /\b(what if|imagine if|could happen|might happen|hypothetical)\b/i,
      /\b(in case of|if ever|scenario)\b/i,
    ],
    penalty: -0.25,
  },
  promotional: {
    patterns: [
      /\b(follow me|subscribe|check out my|link in bio|promo code|download)\b/i,
      /\b(giveaway|contest|win a|click here|buy now|discount|sale ends)\b/i,
    ],
    penalty: -0.20,
  },
  figurative: {
    // "fire"/"smoke" used as slang, food, or leisure — not pollution
    patterns: [
      /\b(track is fire|song is fire|album is fire|mixtape|this is fire 🔥|straight fire)\b/i,
      /\b(smoking hot|fire sale|smoke show|smokeshow|fired up)\b/i,
      /\b(bbq|barbecue|barbeque|bonfire|campfire|grill|tandoor)\b/i,
      /\b(hookah|shisha|vape|vaping|cigarette|smoke break)\b/i,
    ],
    penalty: -0.30,
  },
  shortText: {
    check: (text) => text.replace(/\s/g, "").length < 25,
    penalty: -0.15,
  },
  allCapsSpam: {
    check: (text) => {
      const words = text.split(/\s+/).filter((w) => w.length > 3);
      const capsWords = words.filter((w) => w === w.toUpperCase());
      return words.length > 3 && capsWords.length / words.length > 0.7;
    },
    penalty: -0.10,
  },
  movieMedia: {
    patterns: [
      /\b(movie|film|documentary|trailer|series|episode|book|novel|game)\b/i,
      /\b(watching|binge|review|rating|stars out of)\b/i,
    ],
    penalty: -0.25,
  },
};

function analyzeTextQuality(text) {
  let score = 0.5; // Start neutral
  const signals = [];

  // Boost: witness language
  const lowerText = text.toLowerCase();
  let witnessCount = 0;
  for (const phrase of WITNESS_PHRASES) {
    if (lowerText.includes(phrase)) witnessCount++;
  }
  if (witnessCount > 0) {
    const boost = Math.min(witnessCount * 0.08, 0.15);
    score += boost;
    signals.push(`+witness(${witnessCount})`);
  }

  // Boost: specificity (numbers, named entities)
  let specificityCount = 0;
  for (const pattern of SPECIFICITY_PATTERNS) {
    if (pattern.test(text)) specificityCount++;
  }
  if (specificityCount > 0) {
    const boost = Math.min(specificityCount * 0.05, 0.12);
    score += boost;
    signals.push(`+specific(${specificityCount})`);
  }

  // Boost: urgency markers
  const urgencyPattern = /\b(SOS|urgent|help|please share|emergency|🆘|🚨|⚠️)\b/i;
  if (urgencyPattern.test(text)) {
    score += 0.08;
    signals.push("+urgency");
  }

  // Penalties: noise indicators
  for (const [name, indicator] of Object.entries(NOISE_INDICATORS)) {
    let triggered = false;
    if (indicator.patterns) {
      triggered = indicator.patterns.some((p) => p.test(text));
    } else if (indicator.check) {
      triggered = indicator.check(text);
    }
    if (triggered) {
      score += indicator.penalty;
      signals.push(`-${name}`);
    }
  }

  return { score: Math.max(0, Math.min(1, score)), signals };
}

// --- Signal 2: Engagement Metrics Scoring ---

function scoreEngagement(metrics = {}) {
  if (!metrics || Object.keys(metrics).length === 0) {
    return { score: 0.3, signals: ["no_metrics"] };
  }

  const signals = [];

  const { likes = 0, retweets = 0, replies = 0, views = 0 } = metrics;

  // Logarithmic scaling for each metric
  const rtScore = retweets > 0 ? Math.min(Math.log10(retweets + 1) / 4, 0.3) : 0;
  const likeScore = likes > 0 ? Math.min(Math.log10(likes + 1) / 5, 0.2) : 0;
  const replyScore = replies > 0 ? Math.min(Math.log10(replies + 1) / 4, 0.2) : 0;
  const viewScore = views > 0 ? Math.min(Math.log10(views + 1) / 6, 0.15) : 0;

  let score = rtScore + likeScore + replyScore + viewScore;

  // Engagement velocity boost: high engagement on recent content = breaking news
  const totalEngagement = likes + retweets + replies;
  if (totalEngagement > 500) {
    score += 0.15;
    signals.push("+viral");
  } else if (totalEngagement > 100) {
    score += 0.08;
    signals.push("+trending");
  } else if (totalEngagement > 20) {
    signals.push("+engaged");
  } else {
    signals.push("low_engagement");
  }

  return { score: Math.max(0, Math.min(1, score)), signals };
}

// --- Signal 3: Source Credibility ---

const SOURCE_TRUST = {
  // Official pollution control / civic agencies
  "@pcb_assam": 0.95,
  "@cpcb_official": 0.95,
  "@gmc_guwahati": 0.90,
  "@gmda_guwahati": 0.85,
  "@guwahati_traffic_police": 0.80,
  // Verified news
  "@assam_tribune": 0.85,
  "@gplus_guwahati": 0.85,
  "@pratidin_time": 0.80,
  "@ne_now_news": 0.80,
  "@times_of_assam": 0.80,
  "@guwahati_updates": 0.75,
  // Environment / monitoring
  "@aqi_guwahati": 0.80,
  "@airwatch_ghy": 0.75,
  "@green_guwahati_ngo": 0.75,
  "@clean_guwahati": 0.70,
  "@brahmaputra_greens": 0.70,
  // Local journalists
  "@local_journo_ghy": 0.70,
  "@ward_reporter_ghy": 0.65,
  // Citizen reporters
  "@citizen_reporter1": 0.50,
};

function scoreSourceCredibility(handle, accountMeta = {}) {
  const signals = [];

  // Known handle trust
  const knownTrust = SOURCE_TRUST[handle];
  let score;
  if (knownTrust !== undefined) {
    score = knownTrust;
    if (knownTrust >= 0.90) signals.push("official");
    else if (knownTrust >= 0.75) signals.push("trusted");
    else if (knownTrust >= 0.60) signals.push("known");
    else signals.push("citizen");
  } else {
    score = 0.25; // Unknown handle
    signals.push("unknown");
  }

  // Account metadata adjustments
  const { isVerified, followerCount, accountAgeDays } = accountMeta;

  if (isVerified) {
    score = Math.min(score + 0.15, 1.0);
    signals.push("+verified");
  }

  if (followerCount > 50000) {
    score = Math.min(score + 0.10, 1.0);
    signals.push("+highFollowers");
  } else if (followerCount > 5000) {
    score = Math.min(score + 0.05, 1.0);
  }

  if (accountAgeDays !== undefined && accountAgeDays < 30) {
    score = Math.max(score - 0.15, 0);
    signals.push("-newAccount");
  }

  return { score: Math.max(0, Math.min(1, score)), signals };
}

// --- Signal 4: Temporal Coherence ---

const PRESENT_INDICATORS = [
  "right now", "happening now", "currently", "just now",
  "breaking", "live update", "update:", "is burning",
  "is rising", "still burning", "still dumping",
  "smoke is rising", "getting worse", "ongoing", "underway",
  "at this moment", "as we speak", "real time", "just witnessed",
  "every morning", "every evening", "since morning",
];

const PAST_INDICATORS = [
  "remember when", "back in 20", "years ago", "last year",
  "last month", "old photo", "old video", "throwback",
  "anniversary", "that time when", "used to be",
  "historically", "in 19", "in 200", "looking back",
  "nostalgic", "last diwali", "during diwali last",
];

function analyzeTemporalCoherence(text) {
  const lowerText = text.toLowerCase();
  const signals = [];
  let score = 0.5; // Neutral

  // Check for present/ongoing indicators
  let presentCount = 0;
  for (const phrase of PRESENT_INDICATORS) {
    if (lowerText.includes(phrase)) presentCount++;
  }
  if (presentCount > 0) {
    score += Math.min(presentCount * 0.1, 0.3);
    signals.push(`+present(${presentCount})`);
  }

  // Check for past-tense references
  let pastCount = 0;
  for (const phrase of PAST_INDICATORS) {
    if (lowerText.includes(phrase)) pastCount++;
  }
  if (pastCount > 0) {
    score -= Math.min(pastCount * 0.15, 0.4);
    signals.push(`-past(${pastCount})`);
  }

  // Hashtag analysis: event-specific hashtags boost score
  const yearHashtags = text.match(/#\w*(2026|2025)\b/gi);
  if (yearHashtags) {
    score += 0.1;
    signals.push("+currentYear");
  }

  return { score: Math.max(0, Math.min(1, score)), signals };
}

// --- Signal 5: Cross-Reference / Corroboration ---

function scoreCrossReference(locationName, recentLocationEvents = []) {
  const signals = [];

  if (!locationName || recentLocationEvents.length === 0) {
    return { score: 0.3, signals: ["no_corroboration"] };
  }

  const count = recentLocationEvents.length;

  let score;
  if (count >= 5) {
    score = 0.95;
    signals.push(`+strong_corroboration(${count})`);
  } else if (count >= 3) {
    score = 0.80;
    signals.push(`+corroborated(${count})`);
  } else if (count >= 1) {
    score = 0.55;
    signals.push(`+partial(${count})`);
  } else {
    score = 0.30;
    signals.push("isolated");
  }

  return { score, signals };
}

// --- Weighted Relevancy Calculator ---

function calculateRelevancy(signalScores) {
  let total = 0;
  const breakdown = {};

  for (const [signal, weight] of Object.entries(RELEVANCY_WEIGHTS)) {
    const data = signalScores[signal];
    if (data) {
      const weighted = data.score * weight;
      total += weighted;
      breakdown[signal] = {
        raw: Math.round(data.score * 100) / 100,
        weighted: Math.round(weighted * 100) / 100,
        signals: data.signals,
      };
    }
  }

  return {
    score: Math.round(Math.max(0, Math.min(1, total)) * 100) / 100,
    breakdown,
  };
}

/**
 * Full NLP pipeline — process a report text and return structured data
 * Now includes multi-signal relevancy scoring
 *
 * @param {string} text - Report text
 * @param {object} options - Additional context
 * @param {object} options.engagement - { likes, retweets, replies, views }
 * @param {string} options.handle - Report author handle
 * @param {object} options.accountMeta - { isVerified, followerCount, accountAgeDays }
 * @param {Array}  options.recentLocationEvents - Recent events from same location (for corroboration)
 * @returns {object}
 */
function processText(text, options = {}) {
  const textLocations = extractLocations(text);
  const locations = Array.from(new Set([...textLocations, ...(options.hintLocations || [])]));
  const pollution = classifyPollution(text);
  const severity = assessSeverity(text);
  const affectedCount = extractAffectedCount(text);
  const confidence = calculateConfidence(locations, pollution.score, severity);

  // Relevancy signals
  const textQuality = analyzeTextQuality(text);
  const engagement = scoreEngagement(options.engagement);
  const sourceCredibility = scoreSourceCredibility(
    options.handle || "",
    options.accountMeta || {},
  );
  const temporalCoherence = analyzeTemporalCoherence(text);
  const crossReference = scoreCrossReference(
    locations[0],
    options.recentLocationEvents || [],
  );

  const relevancy = calculateRelevancy({
    textQuality,
    sourceCredibility,
    engagement,
    temporalCoherence,
    crossReference,
  });

  return {
    locations,
    pollutionType: pollution.type,
    pollutionScore: pollution.score,
    severity: severity.label,
    severityLevel: severity.level,
    affectedCount,
    confidence,
    relevancyScore: relevancy.score,
    relevancyBreakdown: relevancy.breakdown,
    isPollution: pollution.score > 0 && confidence >= 0.3,
    isRelevant: relevancy.score >= 0.4,
  };
}

export {
  processText,
  extractLocations,
  classifyPollution,
  assessSeverity,
  analyzeTextQuality,
  scoreEngagement,
  scoreSourceCredibility,
  analyzeTemporalCoherence,
  scoreCrossReference,
  calculateRelevancy,
};
