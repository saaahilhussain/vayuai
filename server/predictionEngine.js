// VayuAI — 24-Hour Explainable Pollution Prediction Engine

import { aqiCategory } from "./sensorGrid.js";

// Diurnal multiplier - represents typical daily patterns (morning/evening rush hour peaks)
function diurnalMultiplier(hour) {
  const table = [
    0.65, 0.60, 0.55, 0.55, 0.60, 0.70,
    0.80, 1.05, 1.15, 1.10, 1.00, 0.90,
    0.95, 0.90, 0.85, 0.85, 0.90, 1.05,
    1.15, 1.10, 1.00, 0.90, 0.80, 0.70,
  ];
  return table[hour] || 0.85;
}

class PredictionEngine {
  /**
   * Calculate weather-based dispersal or stagnation factor.
   */
  static _calculateWeatherFactor(weather) {
    if (!weather) return { factor: 1.0, factors: [] };
    
    let factor = 1.0;
    const factors = [];

    // Wind speed affects dispersal
    if (weather.windSpeed < 5) {
      factor *= 1.25; // Stagnation
      factors.push({ name: "Wind Stagnation", impact: "+25%", description: `Low wind speed (${weather.windSpeed} km/h) traps pollutants` });
    } else if (weather.windSpeed > 15) {
      factor *= 0.85; // Good dispersal
      factors.push({ name: "High Wind Dispersal", impact: "-15%", description: `High wind speed (${weather.windSpeed} km/h) clears pollutants` });
    }

    // Temperature inversion proxy (simplified for night-time cooling)
    if (!weather.isDay && weather.temperature < 20) {
      factor *= 1.15; // Inversion traps pollution
      factors.push({ name: "Night Inversion", impact: "+15%", description: `Cool night temperature (${weather.temperature}°C) traps ground-level pollution` });
    }

    return { factor, factors };
  }

  /**
   * Analyze recent events to determine local trends.
   */
  static _calculateTrendFactor(sensor, recentEvents) {
    if (!recentEvents || recentEvents.length === 0) {
       return { factor: 1.0, factors: [] };
    }

    // Find events near this sensor
    const localEvents = recentEvents.filter(e => {
       if (!e.lat || !e.lng) return false;
       const toRad = (v) => (v * Math.PI) / 180;
       const R = 6371;
       const dLat = toRad(e.lat - sensor.lat);
       const dLng = toRad(e.lng - sensor.lng);
       const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(sensor.lat)) * Math.cos(toRad(sensor.lat)) * Math.sin(dLng / 2) ** 2;
       const dist = 2 * R * Math.asin(Math.sqrt(h));
       return dist <= 3.0; // 3km radius
    });

    if (localEvents.length === 0) return { factor: 1.0, factors: [] };

    let factor = 1.0;
    const factors = [];
    let severitySum = 0;
    const types = {};

    localEvents.forEach(e => {
        severitySum += (e.severityLevel || 1);
        types[e.pollutionType] = (types[e.pollutionType] || 0) + 1;
    });

    // Escalating trend
    if (localEvents.length >= 3) {
        factor *= (1.0 + (localEvents.length * 0.05));
        
        // Find dominant type
        const dominantType = Object.entries(types).sort((a,b) => b[1] - a[1])[0][0];
        const typeLabel = dominantType.replace('_', ' ');
        factors.push({ 
            name: "Escalating Trend", 
            impact: `+${Math.round((factor - 1) * 100)}%`, 
            description: `${localEvents.length} recent reports nearby, mostly ${typeLabel}` 
        });
    }

    return { factor, factors };
  }

  /**
   * Factor in pressure from currently active hotspots.
   */
  static _calculateHotspotPressure(sensor, hotspots) {
    if (!hotspots || hotspots.length === 0) return { pressure: 0, factors: [] };
    
    let totalPressure = 0;
    const factors = [];

    for (const hs of hotspots) {
       const toRad = (v) => (v * Math.PI) / 180;
       const R = 6371;
       const dLat = toRad(hs.lat - sensor.lat);
       const dLng = toRad(hs.lng - sensor.lng);
       const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(sensor.lat)) * Math.cos(toRad(sensor.lat)) * Math.sin(dLng / 2) ** 2;
       const dist = 2 * R * Math.asin(Math.sqrt(h));

       // If sensor is inside or very close to a hotspot
       if (dist <= 2.0) {
           const pressure = (hs.score / 10) * (2.0 - dist); // Scale pressure by distance
           totalPressure += pressure;
           factors.push({
               name: "Hotspot Proximity",
               impact: `+${Math.round(pressure)} AQI`,
               description: `Located near active hotspot #${hs.rank} (${hs.locationName})`
           });
       }
    }

    return { pressure: totalPressure, factors };
  }

  /**
   * Generate 24-hour predictions for all sensors.
   */
  static generatePredictions(sensorGrid, recentEvents, weather, hotspots) {
    const sensors = sensorGrid.getSensorReadings();
    const predictions = [];
    const now = new Date();
    const currentHour = now.getHours();
    let cityWorstAqi = 0;
    let cityWorstLocation = null;
    let crossDangerCount = 0;
    let totalDelta = 0;

    const weatherAnalysis = this._calculateWeatherFactor(weather);

    for (const sensor of sensors) {
        const trendAnalysis = this._calculateTrendFactor(sensor, recentEvents);
        const hotspotAnalysis = this._calculateHotspotPressure(sensor, hotspots);
        
        const hourlyForecast = [];
        let peakAQI = sensor.aqi;
        let peakHour = currentHour;
        let confidenceScore = 50; // Base confidence

        // Build 24h curve
        for (let offset = 1; offset <= 24; offset++) {
            let targetHour = (currentHour + offset) % 24;
            
            // Baseline uses diurnal multiplier relative to current diurnal state
            const currentDiurnal = diurnalMultiplier(currentHour);
            const targetDiurnal = diurnalMultiplier(targetHour);
            const diurnalRatio = targetDiurnal / currentDiurnal;

            // Apply factors
            let predictedAQI = sensor.aqi * diurnalRatio;
            
            // Apply trend and weather factors (decaying over time)
            const decay = Math.max(0.5, 1.0 - (offset * 0.02)); // Influence decays over 24h
            const combinedFactor = 1.0 + ((trendAnalysis.factor * weatherAnalysis.factor - 1.0) * decay);
            
            predictedAQI *= combinedFactor;
            
            // Add hotspot pressure (also decaying)
            predictedAQI += (hotspotAnalysis.pressure * decay);

            // Add some natural noise/variance
            const noise = 1 + (Math.random() - 0.5) * 0.05;
            predictedAQI *= noise;

            predictedAQI = Math.round(Math.max(20, Math.min(500, predictedAQI)));
            const cat = aqiCategory(predictedAQI);

            hourlyForecast.push({
                hour: targetHour,
                offset,
                predictedAQI,
                category: cat.label,
                color: cat.color
            });

            if (predictedAQI > peakAQI) {
                peakAQI = predictedAQI;
                peakHour = targetHour;
            }
        }

        // Aggregate explainability factors
        const allFactors = [...weatherAnalysis.factors, ...trendAnalysis.factors, ...hotspotAnalysis.factors];
        
        // Add diurnal peak explanation if peak is significant
        if (peakAQI > sensor.aqi * 1.1) {
            allFactors.push({
                name: "Diurnal Cycle",
                impact: "Peak",
                description: `Expected daily peak around ${String(peakHour).padStart(2, '0')}:00`
            });
        }

        // Calculate confidence (increases with data signals)
        if (weather) confidenceScore += 10;
        if (trendAnalysis.factors.length > 0) confidenceScore += 20;
        if (sensor.isReal) confidenceScore += 15;
        if (hotspotAnalysis.factors.length > 0) confidenceScore += 10;
        confidenceScore = Math.min(95, confidenceScore);

        const aqiChange = peakAQI - sensor.aqi;
        totalDelta += aqiChange;

        if (peakAQI > 200) crossDangerCount++;
        if (peakAQI > cityWorstAqi) {
            cityWorstAqi = peakAQI;
            cityWorstLocation = sensor.name;
        }

        predictions.push({
            id: sensor.id,
            name: sensor.name,
            lat: sensor.lat,
            lng: sensor.lng,
            currentAQI: sensor.aqi,
            peakAQI,
            peakHour,
            aqiChange,
            confidence: confidenceScore,
            factors: allFactors.slice(0, 3), // Top 3 factors
            hourlyForecast
        });
    }

    // Sort predictions worst-first
    predictions.sort((a, b) => b.peakAQI - a.peakAQI);

    // Determine overall risk
    let overallRisk = "Low";
    if (cityWorstAqi > 400 || crossDangerCount >= 3) overallRisk = "Critical";
    else if (cityWorstAqi > 300 || crossDangerCount >= 1) overallRisk = "High";
    else if (cityWorstAqi > 200) overallRisk = "Moderate";

    return {
        timestamp: new Date().toISOString(),
        summary: {
            overallRisk,
            worstLocation: cityWorstLocation,
            avgChange: Math.round(totalDelta / sensors.length),
            locationsCrossingDanger: crossDangerCount,
            baseWeather: weather ? `${weather.temperature}°C, Wind ${weather.windSpeed}km/h` : "Unknown"
        },
        locations: predictions
    };
  }
}

export { PredictionEngine };
