import { useState, useEffect } from "react";
import LiveMap from "./components/LiveMap";
import LiveFeed from "./components/LiveFeed";
import AlertBanner from "./components/AlertBanner";
import AddTweetModal from "./components/AddTweetModal";
import {
  fetchEvents,
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
  const [mapOpen, setMapOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [isPickingReportLocation, setIsPickingReportLocation] = useState(false);
  const [reportLocationCoords, setReportLocationCoords] = useState(null);

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
            <button
              className={`cb-btn ${heatmapActive ? "cb-active" : ""}`}
              onClick={() => setHeatmapActive(!heatmapActive)}
            >
              Heatmap
            </button>
          )}
          <button
            className={`cb-btn ${!mapOpen ? "cb-active" : ""}`}
            onClick={() => setMapOpen(!mapOpen)}
          >
            {mapOpen ? "Home" : "Show Map"}
          </button>
          <button
            className={`cb-btn ${isAddModalOpen ? "cb-active" : ""}`}
            onClick={() => {
              setIsAddModalOpen(true);
              setIsPickingReportLocation(false);
              setMapOpen(true); // Switch to map when reporting
            }}
          >
            Report
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
