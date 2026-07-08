import { useState, useEffect } from "react";
import LiveMap from "./components/LiveMap";
import LiveFeed from "./components/LiveFeed";
import AlertBanner from "./components/AlertBanner";
import AddTweetModal from "./components/AddTweetModal";
import AuthModal from "./components/AuthModal";
import HotspotPanel from "./components/HotspotPanel";
import PredictionPanel from "./components/PredictionPanel";
import MunicipalPanel from "./components/MunicipalPanel";
import WorkerPanel from "./components/WorkerPanel";
import CitizenPanel from "./components/CitizenPanel";
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
  const [heatmapActive, setHeatmapActive] = useState(false);
  const [speed] = useState(8000);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [criticalAlert, setCriticalAlert] = useState(null);
  const isDarkMode = true;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const { currentUser, userRole, logout } = useAuth();
  const [feedOpen, setFeedOpen] = useState(false);
  const [sensorsActive, setSensorsActive] = useState(false);
  const [hotspotsActive, setHotspotsActive] = useState(false);
  const [predictionsActive, setPredictionsActive] = useState(false);
  const [municipalActive, setMunicipalActive] = useState(false);
  const [workerActive, setWorkerActive] = useState(false);
  const [citizenActive, setCitizenActive] = useState(false);
  const [hotspots, setHotspots] = useState([]);
  const [predictionData, setPredictionData] = useState(null);
  const [isPickingReportLocation, setIsPickingReportLocation] = useState(false);
  const [reportLocationCoords, setReportLocationCoords] = useState(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  
  // Heatmap filtering state
  const [heatmapSelectedStates, setHeatmapSelectedStates] = useState([]);

  // Fetch hotspots periodically
  useEffect(() => {
    if (!currentUser) return;
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
    if (!currentUser) return;
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
    if (!currentUser) return;
    fetchEvents().then((data) => {
      setEvents(data);
      setDisplayEvents(data);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const es = createEventStream((event) => {
      setEvents((prev) => {
        // Find if this is an update to an existing event
        const existingEvent = prev.find((e) => e.id === event.id);

        // Notify if it's an update for the citizen
        if (
          existingEvent &&
          userRole === "citizen" &&
          existingEvent.status !== event.status &&
          event.citizenUid === currentUser?.uid
        ) {
          if (Notification.permission === "granted") {
            new Notification("Complaint Update", {
              body: `Your report status changed to: ${event.status.replace("_", " ")}`,
            });
          }
        }
        // Notify if it's an update for the worker
        if (userRole === "worker" && event.assignedTo === currentUser?.uid) {
          if (!existingEvent || existingEvent.status !== event.status) {
            if (Notification.permission === "granted") {
              new Notification("New Task Update", {
                body: `Task status: ${event.status.replace("_", " ")}`,
              });
            }
          }
        }

        if (existingEvent) {
          return prev.map((e) => (e.id === event.id ? event : e));
        }
        const updated = [...prev, event];
        return updated.slice(-500);
      });

      setDisplayEvents((prev) => {
        const existingEvent = prev.find((e) => e.id === event.id);
        if (existingEvent) {
          return prev.map((e) => (e.id === event.id ? event : e));
        }
        const updated = [...prev, event];
        return updated.slice(-500);
      });

      if (event.severity === "critical" && userRole !== "citizen") {
        setCriticalAlert(event);
      }
    });

    return () => es.close();
  }, [currentUser, userRole]);

  const handleToggleLive = async () => {
    if (isLive) {
      await stopSimulation();
      setIsLive(false);
    } else {
      await startSimulation(speed);
      setIsLive(true);
    }
  };

  const handleRefreshFeed = async () => {
    if (!currentUser) return;
    try {
      const data = await fetchEvents();
      setEvents(data);
      setDisplayEvents(data);
    } catch (err) {
      console.error("Failed to refresh feed:", err);
    }
  };

  const handleCloseReport = () => {
    setIsAddModalOpen(false);
    setIsPickingReportLocation(false);
    setReportLocationCoords(null);
  };

  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  if (!currentUser) {
    return (
      <div
        id="app"
        style={{
          backgroundColor: "#0f172a",
          minHeight: "100vh",
          width: "100vw",
        }}
      >
        <AuthModal forceOpen={true} />
      </div>
    );
  }

  if (userRole === "municipality") {
    const heatmapStateCounts = displayEvents.reduce((acc, event) => {
      const state = event.detailedLocation?.state || event.state;
      if (state) {
        acc[state] = (acc[state] || 0) + 1;
      }
      return acc;
    }, {});

    const filteredMapEvents = heatmapSelectedStates.length > 0 
      ? displayEvents.filter(e => {
          const state = e.detailedLocation?.state || e.state;
          return heatmapSelectedStates.includes(state);
        })
      : displayEvents;

    return (
      <div id="app">
        {/* Render Map in background for Map Tab */}
        <LiveMap
          events={filteredMapEvents}
          heatmapActive={heatmapActive}
          selectedEvent={selectedEvent}
          isDarkMode={isDarkMode}
          sensorsActive={sensorsActive}
          hotspotsActive={hotspotsActive}
          hotspots={hotspots}
          predictionsActive={predictionsActive}
          predictionData={predictionData}
        />

        {isLogoutConfirmOpen && (
          <div className="modal-backdrop">
            <div className="auth-modal" style={{ width: "320px", textAlign: "center" }}>
              <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#f8fafc" }}>Confirm Sign Out</h3>
              <p style={{ color: "#94a3b8", marginBottom: "24px" }}>Are you sure you want to sign out?</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button 
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: "6px", background: "transparent", border: "1px solid #475569", color: "#cbd5e1", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsLogoutConfirmOpen(false);
                    logout();
                  }}
                  style={{ padding: "8px 16px", borderRadius: "6px", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer" }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full Screen Layout */}
        <MunicipalPanel 
          isFullScreen={true} 
          onLogout={handleLogout}
          isLive={isLive}
          onToggleLive={() => setIsLive(!isLive)}
          heatmapActive={heatmapActive}
          setHeatmapActive={setHeatmapActive}
          sensorsActive={sensorsActive}
          setSensorsActive={setSensorsActive}
          onReportClick={() => setIsAddModalOpen(true)}
          hotspots={hotspots}
          predictionData={predictionData}
          onSelectEvent={setSelectedEvent}
          heatmapSelectedStates={heatmapSelectedStates}
          heatmapStateCounts={heatmapStateCounts}
          setHeatmapSelectedStates={setHeatmapSelectedStates}
        />
        
        {isAddModalOpen && (
          <AddTweetModal
            onClose={() => {
              setIsAddModalOpen(false);
              setIsPickingReportLocation(false);
              setReportLocationCoords(null);
            }}
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

  if (userRole === "worker") {
    return (
      <div id="app">
        {/* Render Map in background for Map Tab */}
        <LiveMap
          events={displayEvents}
          heatmapActive={heatmapActive}
          selectedEvent={selectedEvent}
          isDarkMode={isDarkMode}
          sensorsActive={sensorsActive}
          hotspotsActive={false}
          hotspots={hotspots}
          predictionsActive={false}
          predictionData={predictionData}
        />

        {isLogoutConfirmOpen && (
          <div className="modal-backdrop">
            <div className="auth-modal" style={{ width: "320px", textAlign: "center" }}>
              <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#f8fafc" }}>Confirm Sign Out</h3>
              <p style={{ color: "#94a3b8", marginBottom: "24px" }}>Are you sure you want to sign out?</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button 
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: "6px", background: "transparent", border: "1px solid #475569", color: "#cbd5e1", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsLogoutConfirmOpen(false);
                    logout();
                  }}
                  style={{ padding: "8px 16px", borderRadius: "6px", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer" }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full Screen Worker Dashboard */}
        <WorkerPanel 
          isFullScreen={true} 
          onLogout={handleLogout}
          onSelectEvent={setSelectedEvent}
          hotspots={hotspots}
          isLive={isLive}
          onToggleLive={() => setIsLive(!isLive)}
          heatmapActive={heatmapActive}
          setHeatmapActive={setHeatmapActive}
          sensorsActive={sensorsActive}
          setSensorsActive={setSensorsActive}
        />

        {isAddModalOpen && (
          <AddTweetModal
            onClose={() => {
              setIsAddModalOpen(false);
              setIsPickingReportLocation(false);
              setReportLocationCoords(null);
            }}
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

  return (
    <div id="app">
      {mapOpen && (
        <LiveMap
          events={displayEvents}
          heatmapActive={userRole === "citizen" ? false : heatmapActive}
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
            if (userRole === "citizen") setMapOpen(false);
          }}
          onCancelLocationPick={() => {
            setIsPickingReportLocation(false);
            if (userRole === "citizen") setMapOpen(false);
          }}
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
          onRefresh={handleRefreshFeed}
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
          onRefresh={handleRefreshFeed}
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
        <MunicipalPanel onClose={() => setMunicipalActive(false)} globalEvents={events} />
      )}

      {/* Worker Panel */}
      {mapOpen && workerActive && (
        <WorkerPanel onClose={() => setWorkerActive(false)} />
      )}

      {/* Citizen Panel */}
      {citizenActive && (
        <CitizenPanel onClose={() => setCitizenActive(false)} globalEvents={events} />
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
          {userRole === "citizen" ? (
            <>
              <button
                className={`cb-btn ${isAddModalOpen ? "cb-active" : ""}`}
                onClick={() => {
                  if (!currentUser) {
                    setIsAuthModalOpen(true);
                    return;
                  }
                  setIsAddModalOpen(true);
                  setIsPickingReportLocation(false);
                  setCitizenActive(false);
                  // Do not open the map for citizens unless they explicitly click 'Pin on map'
                }}
              >
                Report
              </button>
              <button
                className={`cb-btn ${!mapOpen && !isAddModalOpen && !citizenActive ? "cb-active" : ""}`}
                onClick={() => {
                  setMapOpen(false);
                  setIsAddModalOpen(false);
                  setCitizenActive(false);
                }}
              >
                Live Feed
              </button>
              <button
                className={`cb-btn ${citizenActive ? "cb-active" : ""}`}
                onClick={() => {
                  if (!currentUser) {
                    setIsAuthModalOpen(true);
                    return;
                  }
                  setCitizenActive(true);
                  setIsAddModalOpen(false);
                }}
                style={
                  citizenActive
                    ? {}
                    : { color: "#f472b6", borderColor: "rgba(244,114,182,0.3)" }
                }
              >
                My Complaints
              </button>
              <button
                className="cb-btn"
                onClick={() =>
                  currentUser ? handleLogout() : setIsAuthModalOpen(true)
                }
                style={{ marginLeft: "auto" }}
              >
                {currentUser ? "Logout" : "Login"}
              </button>
            </>
          ) : (
            <>
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
                  {userRole === "municipality" && (
                    <button
                      className={`cb-btn ${municipalActive ? "cb-active" : ""}`}
                      onClick={() => setMunicipalActive(!municipalActive)}
                      style={
                        municipalActive
                          ? {}
                          : {
                              color: "#38bdf8",
                              borderColor: "rgba(56,189,248,0.3)",
                            }
                      }
                    >
                      Command Center
                    </button>
                  )}
                  {userRole === "worker" && (
                    <button
                      className={`cb-btn ${workerActive ? "cb-active" : ""}`}
                      onClick={() => setWorkerActive(!workerActive)}
                      style={
                        workerActive
                          ? {}
                          : {
                              color: "#4ade80",
                              borderColor: "rgba(34,197,94,0.3)",
                            }
                      }
                    >
                      My Tasks
                    </button>
                  )}
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
                onClick={() =>
                  currentUser ? handleLogout() : setIsAuthModalOpen(true)
                }
                style={{ marginLeft: "auto" }}
              >
                {currentUser ? "Logout" : "Login"}
              </button>
            </>
          )}
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

      {/* Logout Confirmation Modal */}
      {isLogoutConfirmOpen && (
        <div
          className="auth-overlay"
          onClick={() => setIsLogoutConfirmOpen(false)}
          style={{ zIndex: 9999 }}
        >
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-header">
              <h2>Confirm Logout</h2>
              <p>Are you sure you want to log out?</p>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                className="cb-btn cb-active"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  logout();
                }}
              >
                Yes
              </button>
              <button
                className="cb-btn"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setIsLogoutConfirmOpen(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tweet Modal Overlay */}
      {isAddModalOpen && (
        <AddTweetModal
          onClose={handleCloseReport}
          isPickingLocation={isPickingReportLocation}
          pickedLocation={reportLocationCoords}
          onStartPinLocation={() => {
            setIsPickingReportLocation(true);
            setMapOpen(true);
          }}
          onCancelPinLocation={() => setIsPickingReportLocation(false)}
          onClearPickedLocation={() => setReportLocationCoords(null)}
        />
      )}
    </div>
  );
}
