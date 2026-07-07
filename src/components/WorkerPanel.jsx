import React, { useState, useEffect, useCallback } from "react";
import "./WorkerPanel.css";
import { useAuth } from "../context/AuthContext";
import { POLLUTION_TYPES, timeAgo, fetchWorkerAssignments, updateWorkerEventStatus, verifyWorkerEvent, fetchHotspots } from "../utils/api";
import { Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

const STATUS_CONFIG = {
  assigned: { label: "Assigned", color: "#8b5cf6", icon: "👥" },
  worker_en_route: { label: "En Route", color: "#f59e0b", icon: "🚚" },
  reached: { label: "Reached", color: "#f59e0b", icon: "📍" },
  cleanup_done: { label: "Pending AI Verification", color: "#0ea5e9", icon: "🤖" },
  resolved: { label: "Resolved", color: "#22c55e", icon: "✅" },
};

export default function WorkerPanel({ onClose }) {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState("active"); // 'active' | 'resolved' | 'all'
  const [activeTab, setActiveTab] = useState("tasks"); // 'tasks' | 'map'
  const [hotspots, setHotspots] = useState([]);

  const loadAssignments = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkerAssignments(currentUser);
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadAssignments();
    fetchHotspots().then(setHotspots).catch(console.error);
  }, [loadAssignments]);

  const handleStatusChange = async (eventId, newStatus) => {
    setActionLoading(eventId);
    try {
      await updateWorkerEventStatus(currentUser, eventId, newStatus);
      await loadAssignments();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyResolution = async (eventId, file) => {
    setActionLoading(eventId);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await verifyWorkerEvent(currentUser, eventId, reader.result, "Resolved by worker");
          await loadAssignments();
        } catch (err) {
          alert(`Verification failed: ${err.message}`);
          setActionLoading(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert(`Failed: ${err.message}`);
      setActionLoading(null);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (filter === "active") return e.status !== "resolved";
    if (filter === "resolved") return e.status === "resolved";
    return true;
  });

  const activeCount = events.filter((e) => e.status !== "resolved").length;
  const resolvedCount = events.filter((e) => e.status === "resolved").length;

  return (
    <div className="worker-panel">
      <div className="wp-header">
        <div className="wp-header-content">
          <div className="wp-header-title">
            <h3>My Assignments</h3>
            <span className="wp-badge wp-badge-role">Field Worker</span>
          </div>
          <span className="wp-subtitle">
            Events assigned to you for resolution
          </span>
        </div>
        <button className="wp-close-btn" onClick={onClose}>×</button>
      </div>

      {/* Main Tabs */}
      <div className="wp-main-tabs" style={{ display: 'flex', borderBottom: '1px solid #374151', marginBottom: '1rem' }}>
        <button 
          style={{ flex: 1, padding: '0.75rem', background: activeTab === 'tasks' ? '#374151' : 'transparent', border: 'none', color: activeTab === 'tasks' ? 'white' : '#9ca3af', cursor: 'pointer' }}
          onClick={() => setActiveTab('tasks')}
        >📋 Tasks</button>
        <button 
          style={{ flex: 1, padding: '0.75rem', background: activeTab === 'map' ? '#374151' : 'transparent', border: 'none', color: activeTab === 'map' ? 'white' : '#9ca3af', cursor: 'pointer' }}
          onClick={() => setActiveTab('map')}
        >🗺️ Nearby Hotspots</button>
      </div>

      {activeTab === 'tasks' && (
        <>
          {/* Stats Bar */}
          <div className="wp-stats">
            <div className="wp-stat">
              <span className="wp-stat-value wp-stat-active">{activeCount}</span>
              <span className="wp-stat-label">Active</span>
            </div>
            <div className="wp-stat">
              <span className="wp-stat-value wp-stat-resolved">{resolvedCount}</span>
              <span className="wp-stat-label">Resolved</span>
            </div>
            <div className="wp-stat">
              <span className="wp-stat-value">{events.length}</span>
              <span className="wp-stat-label">Total</span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="wp-filter-tabs">
            <button
              className={`wp-filter-tab ${filter === "active" ? "wp-filter-active" : ""}`}
              onClick={() => setFilter("active")}
            >
              🔴 Active ({activeCount})
            </button>
            <button
              className={`wp-filter-tab ${filter === "resolved" ? "wp-filter-active" : ""}`}
              onClick={() => setFilter("resolved")}
            >
              🟢 Resolved ({resolvedCount})
            </button>
            <button
              className={`wp-filter-tab ${filter === "all" ? "wp-filter-active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button className="wp-refresh-btn" onClick={loadAssignments} title="Refresh">
              ↻
            </button>
          </div>
        </>
      )}

      {/* Content */}
      <div className="wp-content">
        {activeTab === 'map' && (
           <div style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
             <Map
                defaultZoom={12}
                defaultCenter={{ lat: 26.15, lng: 91.75 }}
                mapId="worker-hotspot-map"
                disableDefaultUI={true}
             >
                {hotspots.map((h, i) => (
                  <AdvancedMarker key={i} position={{ lat: h.lat, lng: h.lng }}>
                    <Pin background="#ef4444" borderColor="#7f1d1d" glyphColor="#7f1d1d" />
                  </AdvancedMarker>
                ))}
                {filteredEvents.map(e => e.lat && e.lng && (
                  <AdvancedMarker key={e.id} position={{ lat: e.lat, lng: e.lng }}>
                    <Pin background="#3b82f6" borderColor="#1e3a8a" glyphColor="#1e3a8a" />
                  </AdvancedMarker>
                ))}
             </Map>
             <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
               <span style={{ color: '#ef4444' }}>🔴 Hotspots</span> | <span style={{ color: '#3b82f6' }}>🔵 My Tasks</span>
             </div>
           </div>
        )}

        {activeTab === 'tasks' && loading && (
          <div className="wp-loading">
            <div className="wp-spinner"></div>
            <span>Loading assignments...</span>
          </div>
        )}

        {!loading && error && (
          <div className="wp-empty">Error: {error}</div>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <div className="wp-empty">
            {filter === "active"
              ? "No active assignments. You're all caught up! 🎉"
              : filter === "resolved"
              ? "No resolved events yet."
              : "No assignments found."}
          </div>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <div className="wp-list">
            {filteredEvents.map((event) => {
              const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.open;
              const pollCfg = POLLUTION_TYPES[event.pollutionType] || POLLUTION_TYPES.other;
              const isActing = actionLoading === event.id;

              return (
                <div
                  key={event.id}
                  className={`wp-card severity-${event.severity}`}
                >
                  <div className="wp-card-strip"></div>

                  {/* Header */}
                  <div className="wp-card-header">
                    <div className="wp-card-type">
                      <span>{pollCfg.icon}</span>
                      <span className="wp-card-type-label">{pollCfg.label}</span>
                    </div>
                    <span
                      className="wp-status-badge"
                      style={{
                        background: `${statusCfg.color}22`,
                        color: statusCfg.color,
                      }}
                    >
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="wp-card-details">
                    <div className="wp-card-location">
                      📍 {event.locationName || "Unknown"}
                    </div>
                    <div className="wp-card-meta">
                      <span>{timeAgo(event.timestamp)}</span>
                      <span>•</span>
                      <span className="wp-severity-tag">{event.severity}</span>
                    </div>
                    {event.text && (
                      <div className="wp-card-text">
                        {event.text.substring(0, 140)}
                        {event.text.length > 140 ? "..." : ""}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="wp-card-actions" style={{ flexDirection: 'column', gap: '8px' }}>
                    {event.status === "assigned" && (
                      <button
                        className="wp-btn wp-btn-primary"
                        disabled={isActing}
                        onClick={() => handleStatusChange(event.id, "worker_en_route")}
                      >
                        🚚 Start Journey
                      </button>
                    )}
                    {event.status === "worker_en_route" && (
                      <button
                        className="wp-btn wp-btn-primary"
                        disabled={isActing}
                        onClick={() => handleStatusChange(event.id, "reached")}
                      >
                        📍 Reached Location
                      </button>
                    )}
                    {event.status === "reached" && (
                      <>
                        <label className="wp-btn wp-btn-resolve" style={{ cursor: isActing ? 'not-allowed' : 'pointer', textAlign: 'center' }}>
                          📸 Upload Completion Photo (AI Verification)
                          <input 
                            type="file" 
                            accept="image/*" 
                            style={{ display: 'none' }}
                            disabled={isActing}
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleVerifyResolution(event.id, e.target.files[0]);
                            }}
                          />
                        </label>
                      </>
                    )}
                    {event.status === "cleanup_done" && (
                      <span className="wp-resolved-label" style={{ color: '#0ea5e9' }}>🤖 Pending Final Review by Municipality</span>
                    )}
                    {event.status === "resolved" && (
                      <span className="wp-resolved-label">✅ Verified & Resolved</span>
                    )}

                    {event.lat && event.lng && (
                       <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="wp-btn wp-btn-secondary"
                          style={{ textAlign: 'center', textDecoration: 'none', background: '#374151', padding: '0.5rem', borderRadius: '4px', color: 'white' }}
                        >
                          🗺️ Navigate
                       </a>
                    )}
                  </div>

                  {isActing && (
                    <div className="wp-action-overlay">
                      <div className="wp-spinner wp-spinner-sm"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
