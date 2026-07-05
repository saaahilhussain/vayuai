// Fetch live weather data for Guwahati using Open-Meteo API
// This acts as a proxy for IMD data, providing wind speed/direction which is crucial for pollution prediction

const GUWAHATI_LAT = 26.15;
const GUWAHATI_LNG = 91.75;
const WEATHER_API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${GUWAHATI_LAT}&longitude=${GUWAHATI_LNG}&current_weather=true`;

let cachedWeather = null;
let lastFetchTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch weather from Open-Meteo
 */
async function fetchRealWeather() {
  try {
    const res = await fetch(WEATHER_API_URL);
    if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
    const data = await res.json();
    
    if (data && data.current_weather) {
      cachedWeather = {
        temperature: data.current_weather.temperature, // °C
        windSpeed: data.current_weather.windspeed,     // km/h
        windDirection: data.current_weather.winddirection, // degrees
        isDay: data.current_weather.is_day === 1,
        time: data.current_weather.time,
        source: "Open-Meteo (Govt/Public Data Proxy)"
      };
      lastFetchTime = Date.now();
      console.log("☁️  Live weather data fetched:", cachedWeather);
    }
  } catch (error) {
    console.error("⚠️  Failed to fetch weather data:", error.message);
  }
}

/**
 * Get current weather (returns cached or fetches if stale)
 */
async function getCurrentWeather() {
  if (!cachedWeather || Date.now() - lastFetchTime > CACHE_TTL) {
    await fetchRealWeather();
  }
  
  // Fallback if API fails
  if (!cachedWeather) {
    return {
      temperature: 28.5,
      windSpeed: 12.0,
      windDirection: 180, // South
      isDay: true,
      time: new Date().toISOString(),
      source: "Simulated Fallback"
    };
  }
  
  return cachedWeather;
}

// Initial fetch on startup
fetchRealWeather();

export { getCurrentWeather };
