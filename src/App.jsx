import { useState, useEffect } from "react";
import LiveMap from "./components/LiveMap";
import LiveFeed from "./components/LiveFeed";
import AlertBanner from "./components/AlertBanner";
import AddTweetModal from "./components/AddTweetModal";
import AuthModal from "./components/AuthModal";
import HotspotPanel from "./components/HotspotPanel";
import PredictionPanel from "./components/PredictionPanel";
import MunicipalPanel from "./components/MunicipalPanel";
import { useAuth } from "./context/AuthContext";
import {
  fetchEvents,
  fetchHotspots,
  fetchPredictions,
  createEventStream,
  startSimulation,
  stopSimulation,
} from "./utils/api";
import "./components/ControlBar.css";

export default function App() {
  const [events, setEvents] = useState([]);
  const [displayEvents, setDisplayEvents] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const [heatmapActive, setHeatmapActive] = useState(true);
  const [speed] = useState(8000);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [criticalAlert, setCriticalAlert] = useState(null);
  const isDarkMode = true;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const { currentUser, userRole, logout } = useAuth();
  const [feedOpen, setFeedOpen] = useState(false);
  const [sensorsActive, setSensorsActive] = useState(true);
  const [hotspotsActive, setHotspotsActive] = useState(false);
  const [predictionsActive, setPredictionsActive] = useState(false);
  const [municipalActive, setMunicipalActive] = useState(false);
  const [hotspots, setHotspots] = useState([]);
  const [predictionData, setPredictionData] = useState(null);
  const [isPickingReportLocation, setIsPickingReportLocation] = useState(false);
  const [reportLocationCoords, setReportLocationCoords] = useState(null);

  // Fetch hotspots periodically
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchHotspots()
        .then((data) => {
          if (!cancelled) setHotspots(data);
        })
        .catch(console.error);
    };
    load();
    const interval = setInterval(load, 15000); // 15 seconds
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [events]); // Also re-fetch if events change rapidly

  // Fetch predictions periodically
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchPredictions()
        .then((data) => {
          if (!cancelled) setPredictionData(data);
        })
        .catch(console.error);
    };
    load();
    const interval = setInterval(load, 60000); // 60 seconds
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [events]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    fetchEvents().then((data) => {
      setEvents(data);
      setDisplayEvents(data);
    });
  }, []);

  useEffect(() => {
    const es = createEventStream((event) => {
      setEvents((prev) => {
        const updated = [...prev, event];
        return updated.slice(-500);
      });
      setDisplayEvents((prev) => {
        const updated = [...prev, event];
        return updated.slice(-500);
      });

      if (event.severity === "critical") {
        setCriticalAlert(event);
      }
    });

    return () => es.close();
  }, []);

  const handleToggleLive = async () => {
    if (isLive) {
      await stopSimulation();
      setIsLive(false);
    } else {
      await startSimulation(speed);
      setIsLive(true);
    }
  };

  const handleCloseReport = () => {
    setIsAddModalOpen(false);
    setIsPickingReportLocation(false);
    setReportLocationCoords(null);
  };

  return (
    <div id="app">
      {mapOpen && (
        <LiveMap
          events={displayEvents}
          heatmapActive={heatmapActive}
          selectedEvent={selectedEvent}
          isDarkMode={isDarkMode}
          sensorsActive={sensorsActive}
          hotspotsActive={hotspotsActive}
          hotspots={hotspots}
          predictionsActive={predictionsActive}
          predictionData={predictionData}
          locationPickActive={isPickingReportLocation}
          pickedReportLocation={reportLocationCoords}
          onReportLocationPick={(coords) => {
            setReportLocationCoords(coords);
            setIsPickingReportLocation(false);
          }}
          onCancelLocationPick={() => setIsPickingReportLocation(false)}
        />
      )}

      {/* Main Feed View */}
      {!mapOpen && (
        <LiveFeed
          events={displayEvents}
          onSelectEvent={(event) => {
            setSelectedEvent({ ...event, _t: Date.now() });
            setMapOpen(true); // Open map when clicking an event to show it
          }}
          onClose={() => {}} // Feed cannot be closed when it's the main view
          isSidebar={false}
        />
      )}

      {/* Sidebar Feed View when Map is Open */}
      {mapOpen && feedOpen && (
        <LiveFeed
          events={displayEvents}
          onSelectEvent={(event) =>
            setSelectedEvent({ ...event, _t: Date.now() })
          }
          onClose={() => setFeedOpen(false)}
          isSidebar={true}
        />
      )}

      {/* Hotspots Panel */}
      {mapOpen && hotspotsActive && (
        <HotspotPanel
          hotspots={hotspots}
          onClose={() => setHotspotsActive(false)}
          onSelectHotspot={(hs) => {
            setSelectedEvent({
              lat: hs.lat,
              lng: hs.lng,
              locationName: hs.locationName,
              severity: hs.severity,
              pollutionType: hs.dominantType,
              text: `Hotspot Center: ${hs.eventCount} nearby reports.`,
              timestamp: new Date().toISOString(),
              _t: Date.now(),
            });
          }}
        />
      )}

      {/* Predictions Panel */}
      {mapOpen && predictionsActive && (
        <PredictionPanel
          predictionData={predictionData}
          onClose={() => setPredictionsActive(false)}
          onSelectLocation={(loc) => {
            setSelectedEvent({
              lat: loc.lat,
              lng: loc.lng,
              locationName: loc.name,
              severity:
                loc.hourlyForecast
                  .find((h) => h.predictedAQI === loc.peakAQI)
                  ?.category.toLowerCase()
                  .replace(" ", "-") || "high",
              pollutionType: "smog", // Generic fallback
              text: `Predicted Peak AQI: ${loc.peakAQI} at ${loc.peakHour}:00. Current AQI: ${loc.currentAQI}.`,
              timestamp: new Date().toISOString(),
              _t: Date.now(),
            });
          }}
        />
      )}

      {/* Municipal Panel */}
      {mapOpen && municipalActive && (
        <MunicipalPanel onClose={() => setMunicipalActive(false)} />
      )}

      {/* Top right Feed Toggle Button when Map is Open */}
      {mapOpen && (
        <button
          className={`feed-fab ${feedOpen ? "feed-fab-active" : ""}`}
          onClick={() => setFeedOpen(!feedOpen)}
        >
          <span className="feed-fab-dot" />
          {feedOpen ? "Hide Feed" : "Feed"}
        </button>
      )}

      {/* Floating bottom control bar */}
      <div className="control-bar">
        <div className="control-bar-inner">
          <button
            className={`cb-btn ${isLive ? "cb-active" : ""}`}
            onClick={handleToggleLive}
          >
            {isLive ? "Live" : "Paused"}
          </button>
          {mapOpen && (
            <>
              <button
                className={`cb-btn ${heatmapActive ? "cb-active" : ""}`}
                onClick={() => setHeatmapActive(!heatmapActive)}
              >
                Heatmap
              </button>
              <button
                className={`cb-btn ${sensorsActive ? "cb-active" : ""}`}
                onClick={() => setSensorsActive(!sensorsActive)}
              >
                Sensors
              </button>
            </>
          )}

          <button
            className={`cb-btn ${mapOpen ? "cb-active" : ""}`}
            onClick={() => setMapOpen(!mapOpen)}
          >
            {mapOpen ? "Go to Home" : "Show Map"}
          </button>

          {mapOpen && (
            <>
              <button
                className={`cb-btn ${hotspotsActive ? "cb-active" : ""}`}
                onClick={() => setHotspotsActive(!hotspotsActive)}
              >
                Hotspots
              </button>
              <button
                className={`cb-btn ${predictionsActive ? "cb-active" : ""}`}
                onClick={() => setPredictionsActive(!predictionsActive)}
              >
                Forecast
              </button>
              <button
                className={`cb-btn ${municipalActive ? "cb-active" : ""}`}
                onClick={() => setMunicipalActive(!municipalActive)}
                style={
                  municipalActive
                    ? {}
                    : { color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)" }
                }
              >
                Command Center
              </button>
            </>
          )}

          <button
            className={`cb-btn ${isAddModalOpen ? "cb-active" : ""}`}
            onClick={() => {
              if (!currentUser) {
                setIsAuthModalOpen(true);
                return;
              }
              setIsAddModalOpen(true);
              setIsPickingReportLocation(false);
              setMapOpen(true); // Switch to map when reporting
            }}
          >
            Report
          </button>
          <button
            className="cb-btn"
            onClick={() => currentUser ? logout() : setIsAuthModalOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            {currentUser ? 'Logout' : 'Login'}
          </button>
        </div>
      </div>

      {criticalAlert && (
        <AlertBanner
          event={criticalAlert}
          onDismiss={() => setCriticalAlert(null)}
          onSelect={(event) => {
            setSelectedEvent(event);
            setCriticalAlert(null);
          }}
        />
      )}

      {/* Auth Modal Overlay */}
      {isAuthModalOpen && (
        <AuthModal onClose={() => setIsAuthModalOpen(false)} />
      )}

      {/* Add Tweet Modal Overlay */}
      {isAddModalOpen && (
        <AddTweetModal
          onClose={handleCloseReport}
          isPickingLocation={isPickingReportLocation}
          pickedLocation={reportLocationCoords}
          onStartPinLocation={() => setIsPickingReportLocation(true)}
          onCancelPinLocation={() => setIsPickingReportLocation(false)}
          onClearPickedLocation={() => setReportLocationCoords(null)}
        />
      )}
    </div>
  );
}
