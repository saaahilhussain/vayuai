import React, { useState, useEffect, useCallback } from "react";
import "./MunicipalPanel.css";
import HotspotPanel from "./HotspotPanel";
import PredictionPanel from "./PredictionPanel";
import LiveFeed from "./LiveFeed";
import { useAuth } from "../context/AuthContext";
import {
  fetchMunicipalBrief,
  fetchMunicipalDashboard,
  fetchMunicipalEvents,
  fetchEvents,
  updateEventStatus,
  assignEventWorker,
  deleteEventById,
  fetchWorkers,
  updateWorkerManualStatus,
  deleteWorkerTeam,
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
  open: { label: "Open (Unassigned)", color: "#ef4444", icon: "🔴" },
  assigned: { label: "Assigned", color: "#8b5cf6", icon: "👥" },
  worker_en_route: { label: "Worker En Route", color: "#f59e0b", icon: "🚚" },
  reached: { label: "Worker Reached", color: "#f59e0b", icon: "📍" },
  cleanup_done: { label: "Needs Final Review", color: "#0ea5e9", icon: "🤖" },
  resolved: { label: "Resolved", color: "#22c55e", icon: "✅" },
};

const STATE_COLORS = [
  "#f97316",
  "#3b82f6",
  "#8b5cf6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#0ea5e9",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
  "#a855f7",
  "#d946ef",
  "#f43f5e",
  "#10b981",
  "#06b6d4",
];

const getStateColor = (stateName) => {
  let hash = 0;
  for (let i = 0; i < stateName.length; i++) {
    hash = stateName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STATE_COLORS[Math.abs(hash) % STATE_COLORS.length];
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
  onSelectEvent,
  heatmapSelectedStates = [],
  heatmapStateCounts = {},
  setHeatmapSelectedStates,
  globalEvents = [],
}) {
  const { currentUser, userRole, userMunicipality } = useAuth();
  const isMunicipal = userRole === "municipality";

  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, manage, brief, map
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [feedOpen, setFeedOpen] = useState(false);
  const [actions, setActions] = useState([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const [actionStates, setActionStates] = useState({});
  const [briefFilter, setBriefFilter] = useState("");

  // New state for assignment confirmation
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [activeEventForDispatch, setActiveEventForDispatch] = useState(null);

  // Management state
  const [dashboard, setDashboard] = useState(null);
  const [events, setEvents] = useState([]);
  const [rawWorkers, setRawWorkers] = useState([]);
  
  // Dynamically derive workers
  const workers = rawWorkers.map((w) => ({
    ...w,
    teamStrength: w.teamStrength || 1,
    status:
      w.manualStatus === "idle"
        ? "idle"
        : w.manualStatus === "busy" || events.some(
              (e) =>
                e.assignedTo === w.uid &&
                e.assignedTeamId === w.teamId &&
                ["assigned", "worker_en_route", "reached", "in_progress"].includes(e.status)
            )
          ? "busy"
          : "idle",
    assignedCount: events.filter((e) => e.assignedTo === w.uid && e.assignedTeamId === w.teamId).length,
  }));

  const [statusFilter, setStatusFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");
  const [teamStatusFilter, setTeamStatusFilter] = useState("");
  const [briefStatusFilter, setBriefStatusFilter] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedEventId, setExpandedEventId] = useState(null);

  const handleNavClick = (tabName) => {
    if (tabName !== activeTab) {
      setStatusFilter("");
      setWardFilter("");
      setTeamStatusFilter("");
      setBriefFilter("");
      setBriefStatusFilter("");
      setExpandedEventId(null);
      if (onSelectEvent) {
        onSelectEvent(null);
      }
    }
    setActiveTab(tabName);
  };

  const [localGlobalEvents, setLocalGlobalEvents] = useState([]);

  const loadGlobalFeed = useCallback(async () => {
    try {
      const data = await fetchEvents();
      setLocalGlobalEvents(data);
    } catch (err) {
      console.error("Failed to load global feed:", err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "feed") {
      loadGlobalFeed();
    }
  }, [activeTab, loadGlobalFeed]);

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
        fetchMunicipalEvents(currentUser, { status: statusFilter }),
        fetchWorkers(currentUser),
      ]);
      setDashboard(dashData);
      setEvents(eventsData?.events || []);
      setRawWorkers(workersData.workers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isMunicipal, statusFilter]);

  useEffect(() => {
    if (activeTab === "brief") loadBrief();
    if (activeTab === "manage" || activeTab === "dashboard")
      loadManagementData();
  }, [activeTab, loadBrief, loadManagementData]);

  const handleAction = (idx, type, workerUid = null) => {
    setActionStates((prev) => {
      const existing = prev[idx];
      const prevWorkerUid = typeof existing === "object" ? existing.workerUid : null;
      return { ...prev, [idx]: { status: type, workerUid: workerUid || prevWorkerUid } };
    });
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

  const handleAssign = async (eventId, workerUid, teamId) => {
    setActionLoading(eventId);
    try {
      if (String(eventId).startsWith("action_")) {
        const actionIdx = parseInt(String(eventId).split("_")[1]);
        handleAction(actionIdx, "in_progress", workerUid);
        await updateWorkerManualStatus(currentUser, workerUid, "busy", teamId);
      } else {
        await assignEventWorker(currentUser, eventId, workerUid, teamId);
        // Clear manual idle status since they are now being assigned work
        await updateWorkerManualStatus(currentUser, workerUid, "clear", teamId);
      }
      await loadManagementData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
      setPendingAssignment(null); // Clear confirmation state if any
    }
  };

  const handleMarkIdle = async (workerUid, teamId) => {
    setActionLoading(`${workerUid}_${teamId}`);
    try {
      const activeEvents = events.filter(e => e.assignedTo === workerUid && e.assignedTeamId === teamId && !["resolved", "cleanup_done"].includes(e.status));
      for (const event of activeEvents) {
        await updateEventStatus(currentUser, event.id, "resolved");
      }
      Object.entries(actionStates).forEach(([idx, stateObj]) => {
        if (stateObj && typeof stateObj === "object" && stateObj.status === "in_progress" && stateObj.workerUid === workerUid && stateObj.teamId === teamId) {
          handleAction(parseInt(idx), "resolved");
        }
      });
      await updateWorkerManualStatus(currentUser, workerUid, "idle", teamId);
      await loadManagementData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTeam = async (workerUid, teamId) => {
    setActionLoading(`${workerUid}_${teamId}`);
    try {
      await deleteWorkerTeam(currentUser, workerUid, teamId);
      setRawWorkers(prev => prev.filter(w => !(w.uid === workerUid && w.teamId === teamId)));
      setConfirmDeleteId(null);
    } catch (err) {
      alert("Failed to delete team: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleForceResolve = async (eventId, workerUid, teamId) => {
    setActionLoading(eventId);
    try {
      await updateEventStatus(currentUser, eventId, "resolved");
      if (workerUid) {
        await updateWorkerManualStatus(currentUser, workerUid, "idle", teamId);
      }
      await loadManagementData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (eventId, message = "Delete this event? This cannot be undone.") => {
    if (!window.confirm(message)) return;
    setActionLoading(eventId);
    try {
      await updateEventStatus(currentUser, eventId, "spam");
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
      {loading && !dashboard && (
        <div className="mp-loading">
          <div className="mp-spinner"></div>
        </div>
      )}
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
              <span className="mp-stat-value">
                {dashboard.byStatus?.open || 0}
              </span>
              <span className="mp-stat-label">Open</span>
            </div>
            <div className="mp-stat">
              <span className="mp-stat-value">
                {dashboard.byStatus?.in_progress || 0}
              </span>
              <span className="mp-stat-label">In Progress</span>
            </div>
            <div className="mp-stat mp-stat-resolved">
              <span className="mp-stat-value">
                {dashboard.byStatus?.resolved || 0}
              </span>
              <span className="mp-stat-label">Resolved</span>
            </div>
            <div className="mp-stat" style={{ gridColumn: "span 2" }}>
              <span className="mp-stat-value">
                {dashboard.avgResponseTime || "N/A"}
              </span>
              <span className="mp-stat-label">Avg Response Time</span>
            </div>
          </div>
          {dashboard.wardPerformance && (
            <div className="mp-stat-row" style={{ marginTop: "20px" }}>
              <div className="mp-stat" style={{ gridColumn: "span 5" }}>
                <span
                  className="mp-stat-label"
                  style={{ marginBottom: "10px" }}
                >
                  Ward Performance (Resolved / Total)
                </span>
                <div className="ward-performance-list">
                  {Object.entries(dashboard.wardPerformance).map(
                    ([ward, stats]) => {
                      const percent =
                        stats.total > 0
                          ? Math.round((stats.resolved / stats.total) * 100)
                          : 0;
                      return (
                        <div key={ward} className="ward-performance-item">
                          <div className="ward-performance-header">
                            <span className="ward-name">{ward}</span>
                            <span className="ward-numbers">
                              {stats.resolved} / {stats.total} resolved (
                              {percent}%)
                            </span>
                          </div>
                          <div className="ward-progress-bar">
                            <div
                              className="ward-progress-fill"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderManageTab = () => {
    const uniqueWards = Array.from(new Set(events.map(e => e.locationName).filter(Boolean)));
    const visibleEvents = events.filter(e => {
      if (wardFilter && e.locationName !== wardFilter) return false;
      if (statusFilter) return e.status === statusFilter;
      return e.status !== "spam";
    });

    return (
    <div className="mdl-tab-content">
      <div className="mdl-page-header">
        <h2 className="mdl-page-title">Manage Reports</h2>
        <div className="mp-filters" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="mp-ward-search" style={{ position: 'relative' }}>
              <input
                type="text"
                list="ward-options"
                placeholder="Search Ward..."
                className="mp-select mp-status-filter"
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                style={{ width: '200px' }}
              />
              <datalist id="ward-options">
                {uniqueWards.map(ward => (
                  <option key={ward} value={ward} />
                ))}
              </datalist>
            </div>
            <select
              className="mp-select mp-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="open">🔴 Open</option>
              <option value="in_progress">🟡 In Progress</option>
              <option value="cleanup_done">⏳ Pending Verification</option>
              <option value="resolved">🟢 Resolved</option>
              <option value="spam">🚩 Reported (Spam)</option>
            </select>
            <button
              className="mp-btn mp-btn-secondary mp-refresh-btn"
              onClick={loadManagementData}
            >
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
      {!loading && !error && visibleEvents.length === 0 && (
        <div className="mp-empty">No events match the selected filter.</div>
      )}
      {!loading && !error && visibleEvents.length > 0 && (
        <div className="mp-list">
          {visibleEvents.map((event) => {
            const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.open;
            const pollCfg =
              POLLUTION_TYPES[event.pollutionType] || POLLUTION_TYPES.other;
            const isActing = actionLoading === event.id;
            const isExpanded = expandedEventId === event.id;

            return (
              <div
                key={event.id}
                className={`mp-card mp-event-card severity-${event.severity} ${isExpanded ? "expanded" : ""}`}
              >
                <div className="mp-priority-strip"></div>

                <div
                  className="mp-event-summary"
                  onClick={() =>
                    setExpandedEventId(isExpanded ? null : event.id)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <div className="mp-event-type">
                    <span>{pollCfg.icon}</span>
                    <span className="mp-event-type-label">{pollCfg.label}</span>
                    {event.reportId && (
                      <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "8px", fontFamily: "monospace" }}>
                        ID: {event.reportId}
                      </span>
                    )}
                  </div>
                  <div className="mp-event-meta-summary">
                    <span
                      className="mp-status-badge"
                      style={{
                        background: `${statusCfg.color}22`,
                        color: statusCfg.color,
                      }}
                    >
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                    <span className="time-ago">{timeAgo(event.timestamp)}</span>
                    <span className="expand-icon">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mp-event-expanded-details">
                    <div className="mp-event-meta-row">
                      <div className="mp-event-location">
                        📍 {event.locationName || "Unknown"}
                      </div>
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
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '8px' }}>
                          <img
                            src={event.imageUrl}
                            alt="Report"
                            className="mp-event-image"
                            style={{ flex: '0 0 auto', maxWidth: '200px' }}
                          />
                          {event.resolutionProofUrl && (
                            <div style={{ flex: '0 0 auto', border: '2px solid #22c55e', borderRadius: '6px', position: 'relative' }}>
                              <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(34,197,94,0.9)', color: 'white', fontSize: '10px', padding: '2px 4px', borderRadius: '4px' }}>Resolution Proof</span>
                              <img
                                src={event.resolutionProofUrl}
                                alt="Resolution Proof"
                                className="mp-event-image"
                                style={{ maxWidth: '200px', margin: 0 }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {!event.imageUrl && event.resolutionProofUrl && (
                         <div style={{ border: '2px solid #22c55e', borderRadius: '6px', position: 'relative', marginBottom: '8px', display: 'inline-block' }}>
                            <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(34,197,94,0.9)', color: 'white', fontSize: '10px', padding: '2px 4px', borderRadius: '4px' }}>Resolution Proof</span>
                            <img
                              src={event.resolutionProofUrl}
                              alt="Resolution Proof"
                              className="mp-event-image"
                            />
                         </div>
                      )}

                    {event.text && (
                      <div className="mp-event-text full-text">
                        {event.text}
                      </div>
                    )}

                    {/* Assignment UI */}
                    {event.assignedTo &&
                      event.status !== "open" &&
                      event.status !== "pending_review" && (
                        <div className="mp-assigned-badge" style={{ marginBottom: "12px" }}>
                          Assigned to:{" "}
                          {workers.find((w) => w.uid === event.assignedTo)
                            ?.name || "Worker"}
                        </div>
                      )}

                    {/* Event Actions */}
                    <div className="mp-actions" style={{ padding: "0", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>

                      {(!event.assignedTo || event.status === "open") && event.status !== "spam" && (
                        <button
                          className="mp-btn mp-btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveEventForDispatch(event);
                            setActiveTab('teams');
                          }}
                          disabled={isActing}
                          style={{
                            flex: 1,
                            minWidth: "200px",
                            padding: "10px 16px",
                            fontWeight: 600,
                            fontSize: "14px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: "8px",
                            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                            border: "none",
                            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                            color: "#ffffff"
                          }}
                        >
                          ⚡ Take Action (Dispatch Team)
                        </button>
                      )}

                      {event.assignedTo && ["in_progress", "assigned"].includes(event.status) && (
                        <button
                          className="mp-btn mp-btn-resolve"
                          disabled={isActing}
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await handleForceResolve(event.id, event.assignedTo, event.assignedTeamId);
                            } catch (err) {
                              alert(`Failed: ${err.message}`);
                            }
                          }}
                          style={{
                            padding: "10px 16px",
                            fontWeight: 600,
                            fontSize: "14px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          ✅ Mark as Resolved
                        </button>
                      )}

                      {event.status === "cleanup_done" && (
                        <>
                          <button
                            className="mp-btn mp-btn-resolve mp-btn-sm"
                            disabled={isActing}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(event.id, "resolved");
                            }}
                            title={
                              event.aiResolutionScore
                                ? `AI Score: ${event.aiResolutionScore}`
                                : "No AI Score"
                            }
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="mp-btn mp-btn-secondary mp-btn-sm"
                            disabled={isActing}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(event.id, "rework");
                            }}
                          >
                            ↩ Reject & Reassign
                          </button>
                        </>
                      )}

                      {event.status === "resolved" && (
                        <button
                          className="mp-btn mp-btn-secondary mp-btn-sm"
                          disabled={isActing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(event.id, "open");
                          }}
                        >
                          ↩ Reopen
                        </button>
                      )}

                      {event.status === "spam" && (
                        <button
                          className="mp-btn mp-btn-secondary mp-btn-sm"
                          disabled={isActing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(event.id, "open");
                          }}
                        >
                          ↩ Restore
                        </button>
                      )}

                      {event.status !== "spam" && (
                        <button
                          className="mp-btn mp-btn-danger"
                          disabled={isActing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(event.id, "Are you sure you want to report this as spam? It will be removed from the live feed.");
                          }}
                          title="Report as spam"
                          style={{
                            padding: "10px 16px",
                            fontWeight: 600,
                            fontSize: "14px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: "8px",
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#fca5a5"
                          }}
                        >
                          🚩 Report (Spam)
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
};

  const renderAIBriefTab = () => {
    const visibleActions = actions.filter((action, idx) => {
      const stateObj = actionStates[idx];
      const state = stateObj ? (typeof stateObj === "string" ? stateObj : stateObj.status) : "open";
      if (briefStatusFilter && state !== briefStatusFilter) return false;
      if (!briefStatusFilter && state === "dismissed") return false;
      if (briefFilter && action.priority !== briefFilter) return false;
      return true;
    });

    return (
      <div className="mdl-tab-content">
        <div className="mdl-page-header">
          <h2 className="mdl-page-title">AI Action Brief</h2>
          <div className="mp-filters">
            <select
              className="mp-select mp-status-filter"
              value={briefStatusFilter}
              onChange={(e) => setBriefStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="open">🟢 Open</option>
              <option value="in_progress">🟡 In Progress</option>
              <option value="resolved">🟢 Resolved</option>
              <option value="dismissed">🔴 Dismissed</option>
            </select>
            <select
              className="mp-select mp-status-filter"
              value={briefFilter}
              onChange={(e) => setBriefFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">🔴 Critical</option>
              <option value="HIGH">🟡 High</option>
              <option value="MODERATE">🔵 Moderate</option>
              <option value="LOW">🟢 Low</option>
            </select>
            <button
              className="mp-btn mp-btn-secondary mp-refresh-btn"
              onClick={loadBrief}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
        {briefLoading && (
          <div className="mp-loading">
            <div className="mp-spinner"></div>
            <span>Generating AI Action Brief...</span>
          </div>
        )}
        {!briefLoading && briefError && (
          <div className="mp-empty">Failed to load brief: {briefError}</div>
        )}
        {!briefLoading && !briefError && visibleActions.length === 0 && (
          <div className="mp-empty">
            No actions match the current filter.
          </div>
        )}
        {!briefLoading && !briefError && visibleActions.length > 0 && (
          <div className="mp-list">
            {actions.map((action, idx) => {
              const stateObj = actionStates[idx];
              const state = stateObj ? (typeof stateObj === "string" ? stateObj : stateObj.status) : "open";
              const workerUid = stateObj && typeof stateObj === "object" ? stateObj.workerUid : null;
              const teamId = stateObj && typeof stateObj === "object" ? stateObj.teamId : null;
              if (briefStatusFilter && state !== briefStatusFilter) return null;
              if (!briefStatusFilter && state === "dismissed") return null;
              if (briefFilter && action.priority !== briefFilter) return null;
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
                  </div>
                  <div className="mp-reason">{action.reason}</div>
                  <div className="mp-actions">
                    {state === "in_progress" ? (
                      <>
                        <button className="mp-btn mp-btn-secondary" disabled>
                          ✅ Team Dispatched
                        </button>
                        <button
                          className="mp-btn mp-btn-resolve"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setActionLoading(`action_resolve_${idx}`);
                            try {
                              handleAction(idx, "resolved");
                              if (workerUid) {
                                await updateWorkerManualStatus(currentUser, workerUid, "idle", teamId);
                                await loadManagementData();
                              }
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                        >
                          {actionLoading === `action_resolve_${idx}` ? "..." : "✅ Mark as Complete"}
                        </button>
                      </>
                    ) : state === "resolved" ? (
                      <button className="mp-btn mp-btn-secondary" disabled>
                        🟢 Task Completed
                      </button>
                    ) : state === "dismissed" ? (
                      <button
                        className="mp-btn mp-btn-secondary"
                        onClick={() => handleAction(idx, "open")}
                      >
                        ↩ Restore
                      </button>
                    ) : (
                      <>
                        <button
                          className="mp-btn mp-btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveEventForDispatch({
                              id: `action_${idx}`,
                              locationName: action.location,
                              isActionBrief: true
                            });
                            setActiveTab('teams');
                          }}
                        >
                          ⚡ Take action (Assign Team)
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
  };

  const renderHotspotsTab = () => (
    <div className="mdl-tab-content fullscreen-panel-wrapper">
      <h2 className="mdl-page-title">Pollution Hotspots</h2>
      <HotspotPanel
        hotspots={hotspots}
        onClose={() => { }}
        onTakeAction={(locationName) => {
          setWardFilter(locationName || "");
          setActiveTab("manage");
        }}
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
          setActiveTab("map");
        }}
      />
    </div>
  );

  const renderForecastTab = () => (
    <div className="mdl-tab-content fullscreen-panel-wrapper">
      <h2 className="mdl-page-title">AQI Forecast</h2>
      <PredictionPanel
        predictionData={predictionData}
        onClose={() => { }}
        onTakeAction={(locationName) => {
          setWardFilter(locationName || "");
          setActiveTab("manage");
        }}
        onSelectLocation={(loc) => {
          onSelectEvent({
            lat: loc.lat,
            lng: loc.lng,
            locationName: loc.name,
            severity:
              loc.hourlyForecast
                .find((h) => h.predictedAQI === loc.peakAQI)
                ?.category.toLowerCase()
                .replace(" ", "-") || "high",
            pollutionType: "smog",
            text: `Predicted Peak AQI: ${loc.peakAQI} at ${loc.peakHour}:00. Current AQI: ${loc.currentAQI}.`,
            timestamp: new Date().toISOString(),
          });
          setActiveTab("map");
        }}
      />
    </div>
  );

  const renderTeamsTab = () => {
    const visibleWorkers = workers.filter(worker => {
      if (teamStatusFilter && worker.status !== teamStatusFilter) return false;
      return true;
    });

    return (
    <div className="mdl-tab-content">
      <div className="mdl-page-header">
        <h2 className="mdl-page-title">Municipal Teams Directory</h2>
        <div className="mp-filters">
          <select
            className="mp-select mp-status-filter"
            value={teamStatusFilter}
            onChange={(e) => setTeamStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="idle">🟢 Idle</option>
            <option value="busy">🔴 Busy</option>
          </select>
          <button
            className="mp-btn mp-btn-secondary mp-refresh-btn"
            onClick={loadManagementData}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {activeEventForDispatch && (
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', color: '#60a5fa' }}>Dispatching Team for Incident</h4>
            <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem' }}>
              📍 {activeEventForDispatch.locationName || 'Unknown Location'}
            </p>
          </div>
          <button
            className="mp-btn mp-btn-secondary"
            onClick={() => {
              setActiveEventForDispatch(null);
              setActiveTab('manage');
            }}
          >
            Cancel Dispatch
          </button>
        </div>
      )}

      <div className="mp-teams-grid">
        {visibleWorkers.length === 0 ? (
          <div className="mp-empty">No teams match the current filter.</div>
        ) : (
          visibleWorkers.map((worker) => (
            <div
              key={worker.uniqueId || worker.uid}
              className={`mp-team-card ${worker.status === "idle" ? "team-idle" : "team-busy"}`}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {confirmDeleteId === worker.uniqueId && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#f8fafc', fontSize: '1.1rem' }}>Delete team {worker.teamName || worker.name}?</h4>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      className="mp-btn mp-btn-danger"
                      onClick={() => handleDeleteTeam(worker.uid, worker.teamId)}
                      disabled={actionLoading === `${worker.uid}_${worker.teamId}`}
                    >
                      {actionLoading === `${worker.uid}_${worker.teamId}` ? '...' : 'Yes, Delete'}
                    </button>
                    <button className="mp-btn mp-btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </div>
                </div>
              )}
              <div className="mp-team-header">
                <div className="mp-team-avatar">
                  {(worker.teamName || worker.name).charAt(0).toUpperCase()}
                </div>
                <div className="mp-team-info">
                  <h3>{worker.teamName || worker.name}</h3>
                  <span className="mp-team-email">{worker.email}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span className={`mp-team-status-badge ${worker.status}`}>
                    {worker.status.toUpperCase()}
                  </span>
                  <button
                    className="mp-btn mp-btn-danger mp-btn-sm"
                    onClick={() => setConfirmDeleteId(worker.uniqueId)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5'
                    }}
                    title="Delete Team"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="mp-team-stats">
                <div className="mp-team-stat">
                  <span className="mp-team-stat-val">
                    {worker.teamStrength}
                  </span>
                  <span className="mp-team-stat-label">Members</span>
                </div>
                <div className="mp-team-stat">
                  <span className="mp-team-stat-val">
                    {worker.assignedCount}
                  </span>
                  <span className="mp-team-stat-label">Assigned Work</span>
                </div>
                {worker.status === "busy" && (
                  <div
                    className="mp-team-stat"
                    style={{ justifyContent: "center" }}
                  >
                    <button
                      onClick={() => handleMarkIdle(worker.uid, worker.teamId)}
                      disabled={actionLoading === `${worker.uid}_${worker.teamId}`}
                      style={{
                        background: "transparent",
                        border: "1px solid #3b82f6",
                        color: "#3b82f6",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: actionLoading === `${worker.uid}_${worker.teamId}` ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                        flex: 1,
                      }}
                    >
                      {actionLoading === `${worker.uid}_${worker.teamId}` ? "Processing..." : "Mark Idle"}
                    </button>
                  </div>
                )}
                {worker.status === "idle" && activeEventForDispatch && (
                  <div
                    className="mp-team-stat"
                    style={{ justifyContent: "center" }}
                  >
                    <button
                      onClick={() => {
                        setPendingAssignment({
                          eventId: activeEventForDispatch.id,
                          workerUid: worker.uid,
                          teamId: worker.teamId,
                          workerName: worker.teamName || worker.name || "Worker",
                          eventLocation: activeEventForDispatch.locationName || "Unknown Location",
                        });
                        setActiveEventForDispatch(null);
                      }}
                      className="mp-btn mp-btn-primary mp-btn-sm"
                      style={{ padding: '6px 12px' }}
                    >
                      Dispatch
                    </button>
                  </div>
                )}
              </div>
              <div
                className="mp-team-details"
                style={{
                  marginTop: "15px",
                  paddingTop: "15px",
                  borderTop: "1px solid #374151",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Lead Worker
                  </span>
                  <span>{worker.workerName || "N/A"}</span>
                </div>
                <div>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Gender
                  </span>
                  <span>{worker.gender || "N/A"}</span>
                </div>
                <div>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Mobile
                  </span>
                  <span>{worker.mobile || "N/A"}</span>
                </div>
                <div>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Govt ID
                  </span>
                  <span>{worker.govtId || "N/A"}</span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Office Address
                  </span>
                  <span>{worker.officeAddress || "N/A"}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

  // If NOT full screen (should not happen for municipalities anymore, but keeping as fallback)
  if (!isFullScreen) {
    return (
      <div className="municipal-panel municipal-panel-wide">
        <div className="mp-header">
          <div className="mp-header-content">
            <div className="mp-header-title">
              <h3>Command Center</h3>
              {isMunicipal && (
                <span className="mp-badge mp-badge-role">Municipality</span>
              )}
            </div>
          </div>
          <button className="mp-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="mp-empty">
          Please log in as municipality to view full dashboard.
        </div>
      </div>
    );
  }

  // Full Screen Dashboard Layout
  return (
    <div
      className={`municipal-dashboard-layout ${activeTab === "map" ? "transparent-layout" : ""}`}
    >
      {pendingAssignment && (
        <div
          className="mp-modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div
            className="mp-modal-content"
            style={{
              background: "#1e293b",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "400px",
              width: "90%",
              border: "1px solid #374151",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.25rem" }}>
              Confirm Dispatch
            </h3>
            <p style={{ margin: "0 0 16px 0", color: "#cbd5e1" }}>
              Are you sure you want to dispatch{" "}
              <strong>{pendingAssignment.workerName}</strong> to the incident at{" "}
              <strong>{pendingAssignment.eventLocation}</strong>?
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="mp-btn mp-btn-secondary"
                onClick={() => setPendingAssignment(null)}
                disabled={actionLoading === pendingAssignment.eventId}
              >
                Cancel
              </button>
              <button
                className="mp-btn mp-btn-primary"
                onClick={() =>
                  handleAssign(
                    pendingAssignment.eventId,
                    pendingAssignment.workerUid,
                    pendingAssignment.teamId
                  )
                }
                disabled={actionLoading === pendingAssignment.eventId}
              >
                {actionLoading === pendingAssignment.eventId
                  ? "Dispatching..."
                  : "Confirm Dispatch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Toggle Button */}
      <button
        className={`sidebar-toggle-btn ${isSidebarOpen ? "open" : "closed"}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title="Toggle Sidebar"
      >
        {isSidebarOpen ? "◀" : "▶"}
      </button>

      {/* Sidebar Navigation */}
      <div className={`mdl-sidebar ${isSidebarOpen ? "" : "collapsed"}`}>
        <div className="mdl-brand">
          <span className="mdl-logo">🌬️</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: 0 }}>VayuAI Command</h2>
            {isMunicipal && userMunicipality && !(!isSidebarOpen) && (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                {userMunicipality}
              </span>
            )}
          </div>
        </div>

        <nav className="mdl-nav">
          <button
            className={`mdl-nav-item ${activeTab === "feed" ? "active" : ""}`}
            onClick={() => handleNavClick("feed")}
          >
            <span className="mdl-nav-icon">📡</span>
            Live Feed
          </button>
          <button
            className={`mdl-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => handleNavClick("dashboard")}
          >
            <span className="mdl-nav-icon">📊</span>
            Dashboard
          </button>
          <button
            className={`mdl-nav-item ${activeTab === "manage" ? "active" : ""}`}
            onClick={() => handleNavClick("manage")}
          >
            <span className="mdl-nav-icon">📋</span>
            Manage Reports
          </button>
          <button
            className={`mdl-nav-item ${activeTab === "teams" ? "active" : ""}`}
            onClick={() => handleNavClick("teams")}
          >
            <span className="mdl-nav-icon">👥</span>
            Teams
          </button>
          <button
            className={`mdl-nav-item ${activeTab === "brief" ? "active" : ""}`}
            onClick={() => handleNavClick("brief")}
          >
            <span className="mdl-nav-icon">🤖</span>
            AI Action Brief
          </button>

          <div
            style={{
              margin: "0",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          ></div>

          <button
            className={`mdl-nav-item ${activeTab === "hotspots" ? "active" : ""}`}
            onClick={() => handleNavClick("hotspots")}
          >
            <span className="mdl-nav-icon">🎯</span>
            Pollution Hotspots
          </button>
          <button
            className={`mdl-nav-item ${activeTab === "forecast" ? "active" : ""}`}
            onClick={() => handleNavClick("forecast")}
          >
            <span className="mdl-nav-icon">🔮</span>
            AQI Forecast
          </button>

          <div
            style={{
              margin: "0",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          ></div>

          <button
            className={`mdl-nav-item ${activeTab === "map" ? "active" : ""}`}
            onClick={() => handleNavClick("map")}
          >
            <span className="mdl-nav-icon">🗺️</span>
            Live Map
          </button>

          {/* Map Controls */}
          {activeTab === "map" && (
            <div className="mdl-map-controls">
              <span className="mdl-controls-header">Map Tools</span>
              <button
                className={`mdl-control-btn ${isLive ? "active" : ""}`}
                onClick={onToggleLive}
              >
                {isLive ? "⏸ Pause Feed" : "▶ Resume Feed"}
              </button>
              <button
                className={`mdl-control-btn ${heatmapActive ? "active" : ""}`}
                onClick={() => setHeatmapActive(!heatmapActive)}
              >
                🔥 Heatmap
              </button>

              {/* State Filter Pills inside map controls box */}
              {heatmapActive && Object.keys(heatmapStateCounts).length > 0 && (
                <div
                  className="state-filter-container"
                  style={{ marginTop: "4px", marginBottom: "8px", padding: 0 }}
                >
                  <span
                    className="state-filter-header"
                    style={{ marginBottom: "4px" }}
                  >
                    Filter by State:
                  </span>
                  <div className="state-filter-pills">
                    {Object.entries(heatmapStateCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([stateName, count]) => {
                        const isSelected =
                          heatmapSelectedStates.includes(stateName);
                        return (
                          <button
                            key={stateName}
                            className={`state-filter-pill ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              if (isSelected) {
                                setHeatmapSelectedStates(
                                  heatmapSelectedStates.filter(
                                    (s) => s !== stateName,
                                  ),
                                );
                              } else {
                                setHeatmapSelectedStates([
                                  ...heatmapSelectedStates,
                                  stateName,
                                ]);
                              }
                            }}
                          >
                            <span
                              className="state-color-indicator"
                              style={{
                                backgroundColor: getStateColor(stateName),
                              }}
                            ></span>
                            <span className="state-name">{stateName}</span>
                            <span className="state-count">{count}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              <button
                className={`mdl-control-btn ${sensorsActive ? "active" : ""}`}
                onClick={() => setSensorsActive(!sensorsActive)}
              >
                📡 IoT Sensors
              </button>
              <button
                className="mdl-control-btn"
                onClick={onReportClick}
                style={{
                  marginTop: "8px",
                  border: "1px solid #3b82f6",
                  color: "#60a5fa",
                }}
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
      <div className="mdl-main">
        {activeTab === "dashboard" && renderDashboardTab()}
        {activeTab === "manage" && renderManageTab()}
        {activeTab === "teams" && renderTeamsTab()}
        {activeTab === "brief" && renderAIBriefTab()}
        {activeTab === "hotspots" && renderHotspotsTab()}
        {activeTab === "forecast" && renderForecastTab()}
        {activeTab === "feed" && (
          <LiveFeed
            events={localGlobalEvents}
            onSelectEvent={() => {}}
            onClose={() => setActiveTab("dashboard")}
            isSidebar={false}
            isEmbedded={true}
            onRefresh={loadGlobalFeed}
          />
        )}
      </div>
    </div>
  );
}
