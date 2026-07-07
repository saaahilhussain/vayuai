import React, { useState, useEffect, useCallback } from "react";
import "./MunicipalPanel.css";
import { useAuth } from "../context/AuthContext";
import {
  fetchMunicipalBrief,
  fetchMunicipalDashboard,
  fetchMunicipalEvents,
  updateEventStatus,
  assignEventWorker,
  deleteEventById,
  fetchWorkers,
  POLLUTION_TYPES,
  timeAgo,
} from "../utils/api";

const RESOURCE_ICONS = {
  water_cannon: "💦",
  cleanup_crew: "🧹",
  inspection: "📋",
  traffic_police: "🛑",
};

const STATUS_CONFIG = {
  pending_review: { label: "Needs Approval", color: "#6b7280", icon: "🕒" },
  open: { label: "Open (Unassigned)", color: "#ef4444", icon: "🔴" },
  assigned: { label: "Assigned", color: "#8b5cf6", icon: "👥" },
  worker_en_route: { label: "Worker En Route", color: "#f59e0b", icon: "🚚" },
  reached: { label: "Worker Reached", color: "#f59e0b", icon: "📍" },
  cleanup_done: { label: "Needs Final Review", color: "#0ea5e9", icon: "🤖" },
  resolved: { label: "Resolved", color: "#22c55e", icon: "✅" },
};

export default function MunicipalPanel({ onClose }) {
  const { currentUser, userRole } = useAuth();
  const isMunicipal = userRole === "municipality";

  const [activeTab, setActiveTab] = useState(isMunicipal ? "manage" : "brief");

  // AI Brief state
  const [actions, setActions] = useState([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const [actionStates, setActionStates] = useState({});

  // Management state
  const [dashboard, setDashboard] = useState(null);
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // eventId being acted on

  // Load AI Brief
  const loadBrief = useCallback(() => {
    setBriefLoading(true);
    fetchMunicipalBrief()
      .then((res) => {
        setActions(res.actions || []);
        setBriefLoading(false);
      })
      .catch((err) => {
        setBriefError(err.message);
        setBriefLoading(false);
      });
  }, []);

  // Load management data
  const loadManagementData = useCallback(async () => {
    if (!currentUser || !isMunicipal) return;
    setLoading(true);
    setError(null);
    try {
      const [dashData, eventsData, workersData] = await Promise.all([
        fetchMunicipalDashboard(currentUser),
        fetchMunicipalEvents(currentUser, statusFilter ? { status: statusFilter } : {}),
        fetchWorkers(currentUser),
      ]);
      setDashboard(dashData);
      setEvents(eventsData.events || []);
      setWorkers(workersData.workers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isMunicipal, statusFilter]);

  useEffect(() => {
    if (activeTab === "brief") loadBrief();
    if (activeTab === "manage") loadManagementData();
  }, [activeTab, loadBrief, loadManagementData]);

  const handleAction = (idx, type) => {
    setActionStates((prev) => ({ ...prev, [idx]: type }));
  };

  const handleStatusChange = async (eventId, newStatus) => {
    setActionLoading(eventId);
    try {
      await updateEventStatus(currentUser, eventId, newStatus);
      await loadManagementData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async (eventId, workerUid) => {
    setActionLoading(eventId);
    try {
      await assignEventWorker(currentUser, eventId, workerUid);
      await loadManagementData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setActionLoading(eventId);
    try {
      await deleteEventById(currentUser, eventId);
      await loadManagementData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="municipal-panel municipal-panel-wide">
      <div className="mp-header">
        <div className="mp-header-content">
          <div className="mp-header-title">
            <h3>Command Center</h3>
            {isMunicipal && <span className="mp-badge mp-badge-role">Municipality</span>}
          </div>
          <span className="mp-subtitle">
            {isMunicipal
              ? "Manage events, assign workers, update statuses"
              : "AI-powered action recommendations"}
          </span>
        </div>
        <button className="mp-close-btn" onClick={onClose}>×</button>
      </div>

      {/* Tabs */}
      {isMunicipal && (
        <div className="mp-tabs">
          <button
            className={`mp-tab ${activeTab === "manage" ? "mp-tab-active" : ""}`}
            onClick={() => setActiveTab("manage")}
          >
            📋 Manage Events
          </button>
          <button
            className={`mp-tab ${activeTab === "brief" ? "mp-tab-active" : ""}`}
            onClick={() => setActiveTab("brief")}
          >
            🤖 AI Brief
          </button>
        </div>
      )}

      {/* AI Brief Tab */}
      {activeTab === "brief" && (
        <>
          {briefLoading && (
            <div className="mp-loading">
              <div className="mp-spinner"></div>
              <span>Generating AI Action Brief...</span>
            </div>
          )}
          {!briefLoading && briefError && (
            <div className="mp-empty">Failed to load brief: {briefError}</div>
          )}
          {!briefLoading && !briefError && actions.length === 0 && (
            <div className="mp-empty">No critical actions recommended at this time.</div>
          )}
          {!briefLoading && !briefError && actions.length > 0 && (
            <div className="mp-list">
              {actions.map((action, idx) => {
                const state = actionStates[idx];
                if (state === "dismissed") return null;
                return (
                  <div key={idx} className={`mp-card priority-${action.priority}`}>
                    <div className="mp-priority-strip"></div>
                    <div className="mp-card-header">
                      <div className="mp-title-row">
                        <div className="mp-icon" title={action.resourceType}>
                          {RESOURCE_ICONS[action.resourceType] || "⚡"}
                        </div>
                        <div className="mp-title-text">
                          <strong>{action.title}</strong>
                          <span className="mp-location">{action.location}</span>
                        </div>
                      </div>
                      <span className="mp-priority-badge">{action.priority}</span>
                    </div>
                    <div className="mp-reason">{action.reason}</div>
                    <div className="mp-actions">
                      {state === "dispatched" ? (
                        <button className="mp-btn mp-btn-secondary" disabled>
                          ✅ Team Dispatched
                        </button>
                      ) : (
                        <>
                          <button
                            className="mp-btn mp-btn-primary"
                            onClick={() => handleAction(idx, "dispatched")}
                          >
                            Dispatch Resource
                          </button>
                          <button
                            className="mp-btn mp-btn-secondary"
                            onClick={() => handleAction(idx, "dismissed")}
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Management Tab */}
      {activeTab === "manage" && (
        <>
          {/* Dashboard Summary */}
          {dashboard && (
            <div className="mp-dashboard">
              <div className="mp-stat-row">
                <div className="mp-stat">
                  <span className="mp-stat-value">{dashboard.last24h}</span>
                  <span className="mp-stat-label">Last 24h</span>
                </div>
                <div className="mp-stat mp-stat-critical">
                  <span className="mp-stat-value">{dashboard.criticalOpen}</span>
                  <span className="mp-stat-label">Critical Open</span>
                </div>
                <div className="mp-stat">
                  <span className="mp-stat-value">{dashboard.byStatus?.open || 0}</span>
                  <span className="mp-stat-label">Open</span>
                </div>
                <div className="mp-stat">
                  <span className="mp-stat-value">{dashboard.byStatus?.in_progress || 0}</span>
                  <span className="mp-stat-label">In Progress</span>
                </div>
                <div className="mp-stat mp-stat-resolved">
                  <span className="mp-stat-value">{dashboard.byStatus?.resolved || 0}</span>
                  <span className="mp-stat-label">Resolved</span>
                </div>
                <div className="mp-stat" style={{ gridColumn: 'span 2' }}>
                  <span className="mp-stat-value">{dashboard.avgResponseTime || 'N/A'}</span>
                  <span className="mp-stat-label">Avg Response Time</span>
                </div>
              </div>
              {dashboard.wardPerformance && (
                <div className="mp-stat-row" style={{ marginTop: '10px' }}>
                  <div className="mp-stat" style={{ gridColumn: 'span 5' }}>
                    <span className="mp-stat-label" style={{ marginBottom: '5px' }}>Ward Performance (Resolved / Total)</span>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      {Object.entries(dashboard.wardPerformance).map(([ward, stats]) => (
                        <div key={ward} style={{ fontSize: '0.85rem' }}>
                          <strong>{ward}:</strong> {stats.resolved}/{stats.total}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter Bar */}
          <div className="mp-filter-bar">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mp-select"
            >
              <option value="">All Statuses</option>
              <option value="open">🔴 Open</option>
              <option value="in_progress">🟡 In Progress</option>
              <option value="resolved">🟢 Resolved</option>
            </select>
            <button className="mp-btn mp-btn-secondary mp-refresh-btn" onClick={loadManagementData}>
              ↻ Refresh
            </button>
          </div>

          {/* Events List */}
          {loading && (
            <div className="mp-loading">
              <div className="mp-spinner"></div>
              <span>Loading events...</span>
            </div>
          )}
          {error && <div className="mp-empty">Error: {error}</div>}
          {!loading && !error && events.length === 0 && (
            <div className="mp-empty">No events match the selected filter.</div>
          )}
          {!loading && !error && events.length > 0 && (
            <div className="mp-list">
              {events.map((event) => {
                const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.open;
                const pollCfg = POLLUTION_TYPES[event.pollutionType] || POLLUTION_TYPES.other;
                const isActing = actionLoading === event.id;

                return (
                  <div key={event.id} className={`mp-card mp-event-card severity-${event.severity}`}>
                    <div className="mp-priority-strip"></div>

                    {/* Event Header */}
                    <div className="mp-event-header">
                      <div className="mp-event-type">
                        <span>{pollCfg.icon}</span>
                        <span className="mp-event-type-label">{pollCfg.label}</span>
                      </div>
                      <div className="mp-event-badges">
                        <span
                          className="mp-status-badge"
                          style={{ background: `${statusCfg.color}22`, color: statusCfg.color }}
                        >
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                        <select
                          className="mp-severity-badge"
                          value={event.severityLevel || 1}
                          onChange={(e) => {
                            // Quick Priority Override (simulated API call)
                            console.log(`Override priority to ${e.target.value}`);
                          }}
                          style={{ border: 'none', background: 'transparent', color: 'inherit', fontWeight: 'bold' }}
                          title="Override Priority"
                        >
                          <option value="1">low</option>
                          <option value="2">moderate</option>
                          <option value="3">high</option>
                          <option value="4">critical</option>
                        </select>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="mp-event-details">
                      <div className="mp-event-location">📍 {event.locationName || "Unknown"}</div>
                      <div className="mp-event-meta">
                        <span>{timeAgo(event.timestamp)}</span>
                        <span>•</span>
                        <span>{event.corroborationCount}x corroborated</span>
                        {event.assignedTo && (
                          <>
                            <span>•</span>
                            <span>👷 Assigned</span>
                          </>
                        )}
                      </div>
                      {event.text && (
                        <div className="mp-event-text">
                          {event.text.substring(0, 120)}
                          {event.text.length > 120 ? "..." : ""}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mp-event-actions">
                      {event.status === "pending_review" && (
                        <>
                          <button
                            className="mp-btn mp-btn-primary mp-btn-sm"
                            disabled={isActing}
                            onClick={() => handleStatusChange(event.id, "open")}
                          >
                            Approve
                          </button>
                          <button
                            className="mp-btn mp-btn-danger mp-btn-sm"
                            disabled={isActing}
                            onClick={() => handleDelete(event.id)}
                          >
                            Reject (Spam)
                          </button>
                        </>
                      )}

                      {event.status === "open" && (
                        <>
                          <select
                            className="mp-select mp-select-sm"
                            defaultValue=""
                            disabled={isActing || workers.length === 0}
                            onChange={(e) => {
                              if (e.target.value) handleAssign(event.id, e.target.value);
                            }}
                          >
                            <option value="" disabled>
                              {workers.length === 0 ? "No teams" : "Assign to Team..."}
                            </option>
                            <optgroup label="Sanitation">
                              <option value="sanitation_team_1">Sanitation Team 1</option>
                              <option value="sanitation_team_2">Sanitation Team 2</option>
                            </optgroup>
                            <optgroup label="Enforcement">
                              <option value="police_squad_alpha">Police Squad Alpha</option>
                            </optgroup>
                          </select>
                        </>
                      )}

                      {event.status === "cleanup_done" && (
                        <>
                          <button
                            className="mp-btn mp-btn-resolve mp-btn-sm"
                            disabled={isActing}
                            onClick={() => handleStatusChange(event.id, "resolved")}
                            title={event.aiResolutionScore ? `AI Score: ${event.aiResolutionScore}` : "No AI Score"}
                          >
                            ✅ Finalize (AI Confirmed)
                          </button>
                          <button
                            className="mp-btn mp-btn-secondary mp-btn-sm"
                            disabled={isActing}
                            onClick={() => handleStatusChange(event.id, "assigned")}
                          >
                            ↩ Reject & Reassign
                          </button>
                        </>
                      )}

                      {event.status === "resolved" && (
                        <button
                          className="mp-btn mp-btn-secondary mp-btn-sm"
                          disabled={isActing}
                          onClick={() => handleStatusChange(event.id, "open")}
                        >
                          ↩ Reopen
                        </button>
                      )}
                      <button
                        className="mp-btn mp-btn-danger mp-btn-sm"
                        disabled={isActing}
                        onClick={() => handleDelete(event.id)}
                        title="Delete event (spam)"
                      >
                        🗑️
                      </button>
                    </div>

                    {isActing && (
                      <div className="mp-action-overlay">
                        <div className="mp-spinner mp-spinner-sm"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
