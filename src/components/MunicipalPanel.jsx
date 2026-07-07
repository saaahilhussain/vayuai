import React, { useState, useEffect, useCallback } from "react";
import "./MunicipalPanel.css";
import HotspotPanel from "./HotspotPanel";
import PredictionPanel from "./PredictionPanel";
import { useAuth } from "../context/AuthContext";
import {
  fetchMunicipalBrief,
  fetchMunicipalDashboard,
  fetchMunicipalEvents,
  updateEventStatus,
  assignEventWorker,
  deleteEventById,
  fetchWorkers,
  updateWorkerManualStatus,
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

export default function MunicipalPanel({ 
  onClose, 
  isFullScreen = false, 
  onLogout,
  isLive,
  onToggleLive,
  heatmapActive,
  setHeatmapActive,
  sensorsActive,
  setSensorsActive,
  onReportClick,
  hotspots,
  predictionData,
  onSelectEvent
}) {
  const { currentUser, userRole } = useAuth();
  const isMunicipal = userRole === "municipality";

  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, manage, brief, map

  // AI Brief state
  const [actions, setActions] = useState([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const [actionStates, setActionStates] = useState({});
  
  // New state for assignment confirmation
  const [pendingAssignment, setPendingAssignment] = useState(null);

  // Management state
  const [dashboard, setDashboard] = useState(null);
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedEventId, setExpandedEventId] = useState(null);

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
      
      // Map real team strength and calculate assigned status/counts
      const enrichedWorkers = (workersData.workers || []).map(w => ({
        ...w,
        teamStrength: w.teamStrength || 1,
        status: w.manualStatus === 'idle' ? 'idle' : (eventsData.events.some(e => e.assignedTo === w.uid && !['resolved', 'cleanup_done'].includes(e.status)) ? 'busy' : 'idle'),
        assignedCount: eventsData.events.filter(e => e.assignedTo === w.uid).length
      }));
      setWorkers(enrichedWorkers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isMunicipal, statusFilter]);

  useEffect(() => {
    if (activeTab === "brief") loadBrief();
    if (activeTab === "manage" || activeTab === "dashboard") loadManagementData();
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
      // Clear manual idle status since they are now being assigned work
      await updateWorkerManualStatus(currentUser, workerUid, 'clear');
      await loadManagementData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
      setPendingAssignment(null); // Clear confirmation state if any
    }
  };

  const handleMarkIdle = async (workerUid) => {
    setActionLoading(workerUid); // reuse for local spinner
    try {
      await updateWorkerManualStatus(currentUser, workerUid, 'idle');
      await loadManagementData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
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

  const renderDashboardTab = () => (
    <div className="mdl-tab-content">
      <h2 className="mdl-page-title">Dashboard Overview</h2>
      {loading && !dashboard && <div className="mp-loading"><div className="mp-spinner"></div></div>}
      {dashboard && (
        <div className="mp-dashboard full-dashboard">
          <div className="mp-stat-row">
            <div className="mp-stat">
              <span className="mp-stat-value">{dashboard.last24h}</span>
              <span className="mp-stat-label">Reports (Last 24h)</span>
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
            <div className="mp-stat-row" style={{ marginTop: '20px' }}>
              <div className="mp-stat" style={{ gridColumn: 'span 5' }}>
                <span className="mp-stat-label" style={{ marginBottom: '10px' }}>Ward Performance (Resolved / Total)</span>
                <div className="ward-performance-list">
                  {Object.entries(dashboard.wardPerformance).map(([ward, stats]) => {
                    const percent = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
                    return (
                      <div key={ward} className="ward-performance-item">
                        <div className="ward-performance-header">
                          <span className="ward-name">{ward}</span>
                          <span className="ward-numbers">{stats.resolved} / {stats.total} resolved ({percent}%)</span>
                        </div>
                        <div className="ward-progress-bar">
                          <div className="ward-progress-fill" style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderManageTab = () => (
    <div className="mdl-tab-content">
      <div className="mdl-page-header">
        <h2 className="mdl-page-title">Manage Events</h2>
        <div className="mp-filter-bar">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mp-select"
          >
            <option value="">All Statuses</option>
            <option value="pending_review">🕒 Pending Review</option>
            <option value="open">🔴 Open</option>
            <option value="in_progress">🟡 In Progress</option>
            <option value="cleanup_done">🤖 Pending AI Verification</option>
            <option value="resolved">🟢 Resolved</option>
          </select>
          <button className="mp-btn mp-btn-secondary mp-refresh-btn" onClick={loadManagementData}>
            ↻ Refresh
          </button>
        </div>
      </div>

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
            const isExpanded = expandedEventId === event.id;

            return (
              <div key={event.id} className={`mp-card mp-event-card severity-${event.severity} ${isExpanded ? 'expanded' : ''}`}>
                <div className="mp-priority-strip"></div>

                <div 
                  className="mp-event-summary" 
                  onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="mp-event-type">
                    <span>{pollCfg.icon}</span>
                    <span className="mp-event-type-label">{pollCfg.label}</span>
                  </div>
                  <div className="mp-event-meta-summary">
                    <span className="mp-status-badge" style={{ background: `${statusCfg.color}22`, color: statusCfg.color }}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                    <span className="time-ago">{timeAgo(event.timestamp)}</span>
                    <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mp-event-expanded-details">
                    <div className="mp-event-meta-row">
                      <div className="mp-event-location">📍 {event.locationName || "Unknown"}</div>
                      <div className="mp-event-meta">
                        <span>{event.corroborationCount}x corroborated</span>
                        {event.assignedTo && (
                          <>
                            <span>•</span>
                            <span>👷 Assigned</span>
                          </>
                        )}
                      </div>
                    </div>

                    {event.imageUrl && (
                       <img src={event.imageUrl} alt="Report" className="mp-event-image" />
                    )}

                    {event.text && (
                      <div className="mp-event-text full-text">
                        {event.text}
                      </div>
                    )}

                    {/* Assignment UI */}
                  {(!event.assignedTo || event.status === "open" || event.status === "pending_review") && (
                    <div className="mp-assignment-section">
                      <select 
                        className="mp-select mp-assign-select"
                        value="" // Always blank by default to act as a dispatch button
                        onChange={(e) => {
                          if (e.target.value) {
                            const selectedWorker = workers.find(w => w.uid === e.target.value);
                            setPendingAssignment({
                              eventId: event.id,
                              workerUid: e.target.value,
                              workerName: selectedWorker?.name || 'Worker',
                              eventLocation: event.locationName || 'Unknown Location'
                            });
                          }
                        }}
                        disabled={isActing}
                      >
                        <option value="" disabled>Dispatch Idle Team...</option>
                        {workers.filter(w => w.status === 'idle').map(w => (
                          <option key={w.uid} value={w.uid}>
                            {w.name} (Strength: {w.teamStrength})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {event.assignedTo && event.status !== "open" && event.status !== "pending_review" && (
                    <div className="mp-assigned-badge">
                      Assigned to: {workers.find(w => w.uid === event.assignedTo)?.name || 'Worker'}
                    </div>
                  )}

                  <div className="mp-actions" style={{ padding: "0" }}>
                      {event.status === "pending_review" && (
                        <>
                          <button
                            className="mp-btn mp-btn-primary mp-btn-sm"
                            disabled={isActing}
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(event.id, "open"); }}
                          >
                            Approve
                          </button>
                          <button
                            className="mp-btn mp-btn-danger mp-btn-sm"
                            disabled={isActing}
                            onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
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
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.target.value) {
                                const selectedWorker = workers.find(w => w.uid === e.target.value);
                                setPendingAssignment({
                                  eventId: event.id,
                                  workerUid: e.target.value,
                                  workerName: selectedWorker?.name || 'Worker',
                                  eventLocation: event.locationName || 'Unknown Location'
                                });
                              }
                            }}
                          >
                            <option value="" disabled>
                              {workers.length === 0 ? "No workers found" : "Assign to Worker..."}
                            </option>
                            {workers.map(worker => (
                              <option key={worker.uid} value={worker.uid}>
                                {worker.name} ({worker.email})
                              </option>
                            ))}
                          </select>
                        </>
                      )}

                      {event.status === "cleanup_done" && (
                        <>
                          <button
                            className="mp-btn mp-btn-resolve mp-btn-sm"
                            disabled={isActing}
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(event.id, "resolved"); }}
                            title={event.aiResolutionScore ? `AI Score: ${event.aiResolutionScore}` : "No AI Score"}
                          >
                            ✅ Finalize (AI Confirmed)
                          </button>
                          <button
                            className="mp-btn mp-btn-secondary mp-btn-sm"
                            disabled={isActing}
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(event.id, "assigned"); }}
                          >
                            ↩ Reject & Reassign
                          </button>
                        </>
                      )}

                      {event.status === "resolved" && (
                        <button
                          className="mp-btn mp-btn-secondary mp-btn-sm"
                          disabled={isActing}
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(event.id, "open"); }}
                        >
                          ↩ Reopen
                        </button>
                      )}
                      
                      {event.status !== "pending_review" && (
                        <button
                          className="mp-btn mp-btn-danger mp-btn-sm"
                          disabled={isActing}
                          onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                          title="Delete event (spam)"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>

                    {isActing && (
                      <div className="mp-action-overlay">
                        <div className="mp-spinner mp-spinner-sm"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderAIBriefTab = () => (
    <div className="mdl-tab-content">
      <h2 className="mdl-page-title">AI Action Brief</h2>
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
    </div>
  );

  const renderHotspotsTab = () => (
    <div className="mdl-tab-content fullscreen-panel-wrapper">
      <h2 className="mdl-page-title">Pollution Hotspots</h2>
      <HotspotPanel
        hotspots={hotspots}
        onClose={() => {}}
        onSelectHotspot={(hs) => {
          onSelectEvent({
            lat: hs.lat,
            lng: hs.lng,
            locationName: hs.locationName,
            severity: hs.severity,
            pollutionType: hs.dominantType,
            text: `Hotspot Center: ${hs.eventCount} nearby reports.`,
            timestamp: new Date().toISOString(),
            _t: Date.now(),
          });
          setActiveTab('map');
        }}
      />
    </div>
  );

  const renderForecastTab = () => (
    <div className="mdl-tab-content fullscreen-panel-wrapper">
      <h2 className="mdl-page-title">AQI Forecast</h2>
      <PredictionPanel
        predictionData={predictionData}
        onClose={() => {}}
        onSelectLocation={(loc) => {
          onSelectEvent({
            lat: loc.lat,
            lng: loc.lng,
            locationName: loc.name,
            severity: loc.hourlyForecast.find((h) => h.predictedAQI === loc.peakAQI)?.category.toLowerCase().replace(" ", "-") || "high",
            pollutionType: "smog",
            text: `Predicted Peak AQI: ${loc.peakAQI} at ${loc.peakHour}:00. Current AQI: ${loc.currentAQI}.`,
            timestamp: new Date().toISOString(),
          });
          setActiveTab('map');
        }}
      />
    </div>
  );

  const renderTeamsTab = () => (
    <div className="mdl-tab-content">
      <h2 className="mdl-page-title">Teams Directory</h2>
      <div className="mp-teams-grid">
        {workers.length === 0 ? (
          <div className="mp-empty">No teams available.</div>
        ) : (
          workers.map(worker => (
            <div key={worker.uid} className={`mp-team-card ${worker.status === 'idle' ? 'team-idle' : 'team-busy'}`}>
              <div className="mp-team-header">
                <div className="mp-team-avatar">
                  {(worker.teamName || worker.name).charAt(0).toUpperCase()}
                </div>
                <div className="mp-team-info">
                  <h3>{worker.teamName || worker.name}</h3>
                  <span className="mp-team-email">{worker.email}</span>
                </div>
                <span className={`mp-team-status-badge ${worker.status}`}>
                  {worker.status.toUpperCase()}
                </span>
              </div>
              <div className="mp-team-stats">
                <div className="mp-team-stat">
                  <span className="mp-team-stat-val">{worker.teamStrength}</span>
                  <span className="mp-team-stat-label">Members</span>
                </div>
                <div className="mp-team-stat">
                  <span className="mp-team-stat-val">{worker.assignedCount}</span>
                  <span className="mp-team-stat-label">Assigned Work</span>
                </div>
                {worker.status === 'busy' && (
                  <div className="mp-team-stat" style={{ justifyContent: 'center' }}>
                    <button 
                      onClick={() => handleMarkIdle(worker.uid)}
                      disabled={actionLoading === worker.uid}
                      style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      {actionLoading === worker.uid ? '...' : 'Mark Idle'}
                    </button>
                  </div>
                )}
              </div>
              <div className="mp-team-details" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #374151', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Lead Worker</span>
                  <span>{worker.workerName || "N/A"}</span>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Gender</span>
                  <span>{worker.gender || "N/A"}</span>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Mobile</span>
                  <span>{worker.mobile || "N/A"}</span>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Govt ID</span>
                  <span>{worker.govtId || "N/A"}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Office Address</span>
                  <span>{worker.officeAddress || "N/A"}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // If NOT full screen (should not happen for municipalities anymore, but keeping as fallback)
  if (!isFullScreen) {
    return (
      <div className="municipal-panel municipal-panel-wide">
        <div className="mp-header">
          <div className="mp-header-content">
            <div className="mp-header-title">
              <h3>Command Center</h3>
              {isMunicipal && <span className="mp-badge mp-badge-role">Municipality</span>}
            </div>
          </div>
          <button className="mp-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="mp-empty">Please log in as municipality to view full dashboard.</div>
      </div>
    );
  }

  // Full Screen Dashboard Layout
  return (
    <div className={`municipal-dashboard-layout ${activeTab === 'map' ? 'transparent-layout' : ''}`}>
      {pendingAssignment && (
        <div className="mp-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="mp-modal-content" style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '90%', border: '1px solid #374151' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem' }}>Confirm Dispatch</h3>
            <p style={{ margin: '0 0 16px 0', color: '#cbd5e1' }}>
              Are you sure you want to dispatch <strong>{pendingAssignment.workerName}</strong> to the incident at <strong>{pendingAssignment.eventLocation}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="mp-btn mp-btn-secondary" 
                onClick={() => setPendingAssignment(null)}
                disabled={actionLoading === pendingAssignment.eventId}
              >
                Cancel
              </button>
              <button 
                className="mp-btn mp-btn-primary" 
                onClick={() => handleAssign(pendingAssignment.eventId, pendingAssignment.workerUid)}
                disabled={actionLoading === pendingAssignment.eventId}
              >
                {actionLoading === pendingAssignment.eventId ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <div className="mdl-sidebar">
        <div className="mdl-brand">
          <span className="mdl-logo">🌬️</span>
          <h2>VayuAI Command</h2>
        </div>
        
        <nav className="mdl-nav">
          <button 
            className={`mdl-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="mdl-nav-icon">📊</span>
            Dashboard
          </button>
          <button 
            className={`mdl-nav-item ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            <span className="mdl-nav-icon">📋</span>
            Manage Events
          </button>
          <button 
            className={`mdl-nav-item ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            <span className="mdl-nav-icon">👥</span>
            Teams
          </button>
          <button 
            className={`mdl-nav-item ${activeTab === 'brief' ? 'active' : ''}`}
            onClick={() => setActiveTab('brief')}
          >
            <span className="mdl-nav-icon">🤖</span>
            AI Action Brief
          </button>
          
          <div style={{ margin: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}></div>
          
          <button 
            className={`mdl-nav-item ${activeTab === 'hotspots' ? 'active' : ''}`}
            onClick={() => setActiveTab('hotspots')}
          >
            <span className="mdl-nav-icon">🎯</span>
            Pollution Hotspots
          </button>
          <button 
            className={`mdl-nav-item ${activeTab === 'forecast' ? 'active' : ''}`}
            onClick={() => setActiveTab('forecast')}
          >
            <span className="mdl-nav-icon">🔮</span>
            AQI Forecast
          </button>
          
          <div style={{ margin: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}></div>

          <button 
            className={`mdl-nav-item ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <span className="mdl-nav-icon">🗺️</span>
            Live Map
          </button>

          {/* Map Controls */}
          {activeTab === 'map' && (
            <div className="mdl-map-controls">
              <span className="mdl-controls-header">Map Tools</span>
              <button 
                className={`mdl-control-btn ${isLive ? 'active' : ''}`}
                onClick={onToggleLive}
              >
                {isLive ? '⏸ Pause Feed' : '▶ Resume Feed'}
              </button>
              <button 
                className={`mdl-control-btn ${heatmapActive ? 'active' : ''}`}
                onClick={() => setHeatmapActive(!heatmapActive)}
              >
                🔥 Heatmap
              </button>
              <button 
                className={`mdl-control-btn ${sensorsActive ? 'active' : ''}`}
                onClick={() => setSensorsActive(!sensorsActive)}
              >
                📡 IoT Sensors
              </button>
              <button 
                className="mdl-control-btn"
                onClick={onReportClick}
                style={{ marginTop: '8px', border: '1px solid #3b82f6', color: '#60a5fa' }}
              >
                📸 Report Incident
              </button>
            </div>
          )}
        </nav>

        <div className="mdl-sidebar-footer">
          <div className="mdl-user-info">
            <span className="mdl-user-email">{currentUser?.email}</span>
            <span className="mp-badge mp-badge-role">Municipality</span>
          </div>
          <button className="mdl-logout-btn" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="mdl-main" 
      >
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'manage' && renderManageTab()}
        {activeTab === 'teams' && renderTeamsTab()}
        {activeTab === 'brief' && renderAIBriefTab()}
        {activeTab === 'hotspots' && renderHotspotsTab()}
        {activeTab === 'forecast' && renderForecastTab()}
      </div>
    </div>
  );
}
