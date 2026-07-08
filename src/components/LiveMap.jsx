import { useEffect, useState, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, MapControl, ControlPosition } from "@vis.gl/react-google-maps";
import { POLLUTION_TYPES, timeAgo, fetchSensors } from "../utils/api";
import "./LiveMap.css";

const GUWAHATI_CENTER = { lat: 26.15, lng: 91.75 };
const GUWAHATI_BOUNDS = {
  north: 26.35,
  south: 25.95,
  west: 91.45,
  east: 92.05,
};

function isInsideGuwahati(lat, lng) {
  return (
    lat >= GUWAHATI_BOUNDS.south &&
    lat <= GUWAHATI_BOUNDS.north &&
    lng >= GUWAHATI_BOUNDS.west &&
    lng <= GUWAHATI_BOUNDS.east
  );
}

const SEVERITY_PIN_BG = {
  critical: "#ef4444",
  high: "#f97316",
  moderate: "#eab308",
  low: "#3b82f6",
};

// Twitter/X SVG icons (14x14)
const ICON_REPLY = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
);
const ICON_HEART = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
);
const ICON_RETWEET = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2h3.5v2H7.5c-2.21 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H13V4h3.5c2.21 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
);
const ICON_VIEWS = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8.75 21V3h2v18h-2zM18.75 21V8.5h2V21h-2zM13.75 21v-9h2v9h-2zM3.75 21v-4h2v4h-2z"/></svg>
);

const darkStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

const HeatmapLayer = ({ events, heatmapActive }) => {
  const map = useMap();
  const [heatmap, setHeatmap] = useState(null);

  useEffect(() => {
    if (!map || !window.google || !window.google.maps.visualization) return;
    
    const hm = new window.google.maps.visualization.HeatmapLayer({
      map: null,
      radius: 30,
      opacity: 0.8,
    });
    setHeatmap(hm);

    return () => {
      hm.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (!heatmap || !window.google) return;
    
    if (heatmapActive) {
      heatmap.setMap(map);
      const data = events.filter(e => e.lat && e.lng).map(e => ({
        location: new window.google.maps.LatLng(e.lat, e.lng),
        weight: (e.severityLevel || 1) / 4,
      }));
      heatmap.setData(data);
      heatmap.setOptions({
        radius: 30,
        opacity: 0.8,
        gradient: [
          "rgba(0, 0, 0, 0)",
          "rgba(255, 255, 0, 1)",     // Yellow
          "rgba(255, 200, 0, 1)",
          "rgba(255, 150, 0, 1)",     // Orange
          "rgba(255, 100, 0, 1)",
          "rgba(255, 50, 0, 1)",      // Red-orange
          "rgba(255, 0, 0, 1)",       // Red
          "rgba(200, 0, 0, 1)",       // Dark Red
          "rgba(150, 0, 0, 1)",       // Darker Red
          "rgba(100, 0, 0, 1)"        // Darkest Red
        ]
      });
    } else {
      heatmap.setMap(null);
    }
  }, [events, heatmapActive, heatmap, map]);

  return null;
};


const CustomInfoWindow = ({ event, onClose }) => {
  const [isTranslated, setIsTranslated] = useState(false);
  if (!event) return null;

  const engagement = event.engagement || {};
  const severity = event.severity || "low";
  const typeLabel = POLLUTION_TYPES[event.pollutionType]?.label || "Unknown";
  const relevancy = event.relevancyScore ? Math.round(event.relevancyScore * 100) : "—";
  const vision = event.imageAnalysis?.available ? event.imageAnalysis : null;
  const imageSrc = event.imageUrl || "";
  const visionSummary = vision?.summary || vision?.visibleSignals?.join(", ") || "";
  const textToShow = isTranslated && event.translatedText ? event.translatedText : event.text;

  return (
    <div className={`map-tweet-popup ${imageSrc ? 'mtp-has-image' : ''}`} style={{ position: "relative" }}>
      <button 
        onClick={onClose}
        title="Close"
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          width: "26px",
          height: "26px",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          padding: 0
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      {imageSrc && (
        <div className="mtp-image">
          <img src={imageSrc} alt="" loading="lazy" />
        </div>
      )}
      <div className="mtp-header">
        <div className={`mtp-dot ${severity}`}></div>
        <div className="mtp-user">
          <span className="mtp-name">{event.locationName || "Unknown"}{event.state ? ", " + event.state : ""}</span>
          <span className="mtp-handle">{event.handle || "@unknown"}</span>
        </div>
        <span className="mtp-severity">{severity}</span>
      </div>
      <div className="mtp-text">{textToShow}</div>
      <div className="mtp-meta">
        <span className="mtp-type">{typeLabel}</span>
        <span className="mtp-separator">·</span>
        <span className="mtp-time">{timeAgo(event.timestamp)}</span>
        <span className="mtp-separator">·</span>
        <span className="mtp-relevancy">{relevancy}%</span>
        {event.translatedText && (
          <button className="mtp-translate-btn" onClick={(e) => { e.stopPropagation(); setIsTranslated(!isTranslated); }}>
            {isTranslated ? "Original" : "Translate"}
          </button>
        )}
      </div>
      {vision && (
        <div className="mtp-vision">
          <span>Gemini Vision</span>
          <strong>{Math.round(vision.confidence * 100)}%</strong>
          <p>{visionSummary}</p>
        </div>
      )}
      {(event.fusedConfidence > 0 || event.corroborationCount > 1 || event.sensorCorroboration) && (
        <div className="mtp-fusion">
          {event.fusedConfidence > 0 && (
            <span className="mtp-fused-badge">
              Fused: {Math.round(event.fusedConfidence * 100)}%
            </span>
          )}
          {event.corroborationCount > 1 && (
            <span className="mtp-corr-badge">
              {event.corroborationCount} sources
            </span>
          )}
          {event.sensorCorroboration?.corroborates && (
            <span className="mtp-sensor-badge">
              📡 AQI {event.sensorCorroboration.aqi} ({event.sensorCorroboration.sensorName})
            </span>
          )}
        </div>
      )}
      <div className="mtp-engagement">
        <span>{ICON_REPLY} {engagement.replies || 0}</span>
        <span>{ICON_HEART} {engagement.likes || 0}</span>
        <span>{ICON_RETWEET} {engagement.retweets || 0}</span>
        <span>{ICON_VIEWS} {engagement.views || 0}</span>
      </div>
    </div>
  );
};

const MyLocationControl = ({ setMapCenter, setMapZoom }) => {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const handleLocationClick = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(pos);
        setMapCenter(pos);
        setMapZoom(17);
        if (map) {
          map.panTo(pos);
          map.setZoom(17);
        }
        setLoading(false);
      },
      () => {
        alert("Error: The Geolocation service failed.");
        setLoading(false);
      }
    );
  };

  return (
    <>
      <MapControl position={ControlPosition.RIGHT_BOTTOM}>
        <div style={{ paddingRight: "10px", paddingBottom: "22px" }}>
          <button
            onClick={handleLocationClick}
            title="Show Your Location"
            style={{
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: "4px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              cursor: "pointer",
              width: "38px",
              height: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ededed",
            }}
          >
            {loading ? (
              <span style={{ fontSize: "10px" }}>...</span>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="1" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="1" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="23" y2="12" />
              </svg>
            )}
          </button>
        </div>
      </MapControl>
      {userLocation && (
        <AdvancedMarker position={userLocation} zIndex={1000}>
          <div
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: "#3b82f6",
              borderRadius: "50%",
              border: "3px solid white",
              boxShadow: "0 0 10px rgba(0,0,0,0.4)",
            }}
          />
        </AdvancedMarker>
      )}
    </>
  );
};

const MapSearchBar = () => {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        setSuggestions(data || []);
        setShowDropdown(true);
      } catch (err) {
        // ignore
      }
    }, 500); // Debounce
    return () => clearTimeout(delay);
  }, [query]);

  const selectLocation = (lat, lon, displayName) => {
    setQuery(displayName);
    setShowDropdown(false);
    map.panTo({ lat: parseFloat(lat), lng: parseFloat(lon) });
    map.setZoom(16);
  };
  
  const search = async (e) => {
    e.preventDefault();
    if(!query.trim()) return;
    if (suggestions.length > 0) {
       selectLocation(suggestions[0].lat, suggestions[0].lon, suggestions[0].display_name);
       return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if(data && data.length > 0) {
        selectLocation(data[0].lat, data[0].lon, data[0].display_name);
      } else {
        alert("Location not found");
      }
    } catch (err) {
      alert("Search failed");
    }
  };

  return (
    <div style={{ padding: '10px', position: 'relative' }}>
      <form onSubmit={search} style={{ 
        display: 'flex', 
        gap: '8px', 
        background: 'rgba(15, 23, 42, 0.95)', 
        padding: '8px', 
        borderRadius: '8px', 
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
      }}>
         <input 
           type="text" 
           placeholder="Search any location..." 
           value={query}
           onChange={e => setQuery(e.target.value)}
           onFocus={() => setShowDropdown(true)}
           onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
           style={{ 
             background: 'rgba(0,0,0,0.5)', 
             border: '1px solid rgba(255,255,255,0.1)', 
             color: 'white', 
             padding: '8px 12px', 
             borderRadius: '6px', 
             outline: 'none',
             minWidth: '250px',
             fontFamily: 'Inter, sans-serif'
           }}
         />
         <button 
           type="submit" 
           style={{ 
             background: 'rgba(56, 189, 248, 0.2)', 
             border: '1px solid rgba(56, 189, 248, 0.4)', 
             color: '#38bdf8',
             padding: '8px 16px',
             borderRadius: '6px',
             cursor: 'pointer',
             fontWeight: 600,
             transition: 'all 0.2s ease'
           }}
           onMouseOver={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.3)'}
           onMouseOut={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)'}
         >
           Find
         </button>
      </form>

      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '10px',
          right: '10px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '8px',
          marginTop: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {suggestions.map((s, i) => (
            <div 
              key={i} 
              onClick={() => selectLocation(s.lat, s.lon, s.display_name)}
              style={{
                padding: '10px 12px',
                color: '#e2e8f0',
                cursor: 'pointer',
                borderBottom: i === suggestions.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                fontSize: '13px'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {s.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function LiveMap({
  events,
  heatmapActive,
  selectedEvent,
  isDarkMode,
  sensorsActive,
  hotspotsActive,
  hotspots = [],
  predictionsActive,
  predictionData,
  locationPickActive,
  pickedReportLocation,
  onReportLocationPick,
  onCancelLocationPick,
}) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapCenter, setMapCenter] = useState(GUWAHATI_CENTER);
  const [mapZoom, setMapZoom] = useState(12);
  const [sensors, setSensors] = useState([]);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const tokenMissing = !apiKey || apiKey === "your_token_here";

  // Fetch sensor data periodically when sensors are active
  useEffect(() => {
    if (!sensorsActive) return;
    let cancelled = false;
    const load = () => {
      fetchSensors().then((data) => {
        if (!cancelled) setSensors(data);
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [sensorsActive]);

  useEffect(() => {
    if (selectedEvent && selectedEvent.lat && selectedEvent.lng) {
      setMapCenter({ lat: selectedEvent.lat, lng: selectedEvent.lng });
      setMapZoom(14);
      setSelectedMarker(selectedEvent);
    } else if (selectedEvent === null) {
      setSelectedMarker(null);
    }
  }, [selectedEvent]);

  if (tokenMissing) {
    return (
      <div className="livemap-container">
        <div
          className="map-overlay"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "20px",
            borderRadius: "8px",
            zIndex: 1000,
            textAlign: "center",
          }}
        >
          <p>Set VITE_GOOGLE_MAPS_API_KEY in a .env file to load the map.</p>
        </div>
      </div>
    );
  }

  const mapOptions = {
    restriction: {
      latLngBounds: GUWAHATI_BOUNDS,
      strictBounds: false,
    },
    disableDefaultUI: true,
    zoomControl: true,
  };

  const handleMapClick = (e) => {
    if (!locationPickActive) return;
    const lat = e.detail.latLng.lat;
    const lng = e.detail.latLng.lng;
    if (isInsideGuwahati(lat, lng)) {
      onReportLocationPick?.({ lat, lng });
    }
  };

  return (
    <div className={`livemap-container ${locationPickActive ? "location-pick-active" : ""}`}>
      <APIProvider apiKey={apiKey} libraries={["visualization"]} version="3.64">
        <Map
          defaultCenter={GUWAHATI_CENTER}
          defaultZoom={12}
          center={mapCenter}
          onCenterChanged={(e) => setMapCenter(e.detail.center)}
          zoom={mapZoom}
          onZoomChanged={(e) => setMapZoom(e.detail.zoom)}
          mapId="vayuai-map"
          options={mapOptions}
          colorScheme={isDarkMode ? "DARK" : "LIGHT"}
          onClick={handleMapClick}
          style={{ width: "100%", height: "100%" }}
          gestureHandling="greedy"
        >
          <MapControl position={ControlPosition.TOP_CENTER}>
            <MapSearchBar />
          </MapControl>

          {locationPickActive && (
            <MapControl position={ControlPosition.TOP_CENTER}>
              <div style={{ padding: '10px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  background: 'rgba(59, 130, 246, 0.95)', 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  color: 'white',
                  fontWeight: 500,
                  backdropFilter: 'blur(8px)',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  <span>Click the incident location on the map</span>
                  <button 
                    type="button" 
                    onClick={onCancelLocationPick}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </MapControl>
          )}

          <MyLocationControl setMapCenter={setMapCenter} setMapZoom={setMapZoom} />
          
          <HeatmapLayer events={events} heatmapActive={heatmapActive} />

          {!heatmapActive && events.filter(e => e.lat && e.lng && e.isUserSubmitted).map(event => {
            const severity = event.severity || "low";
            const bg = SEVERITY_PIN_BG[severity] || SEVERITY_PIN_BG.low;
            return (
              <AdvancedMarker
                key={event.id}
                position={{ lat: event.lat, lng: event.lng }}
                onClick={() => setSelectedMarker(event)}
              >
                <Pin background={bg} borderColor={"#ffffff"} glyphColor={"#ffffff"} />
              </AdvancedMarker>
            );
          })}

          {pickedReportLocation && (
            <AdvancedMarker position={{ lat: pickedReportLocation.lat, lng: pickedReportLocation.lng }}>
              <Pin background={"#000000"} borderColor={"#ffffff"} glyphColor={"#ffffff"} />
            </AdvancedMarker>
          )}

          {/* Sensor markers */}
          {sensorsActive && sensors.map(sensor => (
            <AdvancedMarker
              key={sensor.id}
              position={{ lat: sensor.lat, lng: sensor.lng }}
              zIndex={50}
            >
              <div
                className="sensor-marker"
                style={{ '--sensor-color': sensor.color }}
                title={`${sensor.name}\nAQI: ${sensor.aqi} (${sensor.category})\nPM2.5: ${sensor.pm25} · PM10: ${sensor.pm10}`}
              >
                <span className="sensor-marker-value">{sensor.aqi}</span>
                <span className="sensor-marker-label">AQI</span>
              </div>
            </AdvancedMarker>
          ))}

          {/* Hotspot overlays */}
          {hotspotsActive && hotspots.map((hs) => {
            const size = Math.max(60, Math.min(150, hs.radiusMeters / 4)); // Scale for visibility
            return (
              <AdvancedMarker
                key={hs.id}
                position={{ lat: hs.lat, lng: hs.lng }}
                zIndex={40}
              >
                <div 
                  className={`hotspot-radar severity-${hs.severity}`}
                  style={{ width: size, height: size, marginTop: -size/2, marginLeft: -size/2 }}
                >
                  <div className="hotspot-radar-ring"></div>
                  <div className="hotspot-radar-center">
                    <span>#{hs.rank}</span>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

          {/* Forecast Overlays */}
          {predictionsActive && predictionData?.locations?.map(loc => {
            const peakColor = loc.hourlyForecast.find(h => h.predictedAQI === loc.peakAQI)?.color || '#fff';
            return (
              <AdvancedMarker
                key={`pred-${loc.id}`}
                position={{ lat: loc.lat, lng: loc.lng }}
                zIndex={60}
              >
                <div className="forecast-marker" style={{ '--peak-color': peakColor }}>
                  <div className="forecast-ring"></div>
                  <div className="forecast-marker-box">
                    <span className="forecast-val-current">{loc.currentAQI}</span>
                    <span className="forecast-arrow">→</span>
                    <span className="forecast-val-peak">{loc.peakAQI}</span>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

          {selectedMarker && (
            <InfoWindow
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={() => setSelectedMarker(null)}
              headerDisabled={true}
              style={{ padding: 0 }}
            >
              <CustomInfoWindow event={selectedMarker} onClose={() => setSelectedMarker(null)} />
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

    </div>
  );
}
