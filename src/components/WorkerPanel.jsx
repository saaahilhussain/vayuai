import React, { useState, useEffect, useCallback } from "react";
import "./WorkerPanel.css";
import { useAuth } from "../context/AuthContext";
import { POLLUTION_TYPES, timeAgo, fetchWorkerAssignments, updateWorkerEventStatus, verifyWorkerEvent, fetchHotspots, fetchWorkerProfile, updateWorkerProfile } from "../utils/api";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

const STATUS_CONFIG = {
  assigned: { label: "Assigned", color: "#8b5cf6", icon: "👥" },
  worker_en_route: { label: "En Route", color: "#f59e0b", icon: "🚚" },
  reached: { label: "Reached", color: "#f59e0b", icon: "📍" },
  cleanup_done: { label: "Pending AI Verification", color: "#0ea5e9", icon: "🤖" },
  resolved: { label: "Resolved", color: "#22c55e", icon: "✅" },
};

export default function WorkerPanel({ 
  onClose, 
  isFullScreen = false, 
  onLogout, 
  onSelectEvent, 
  hotspots: propHotspots,
  isLive,
  onToggleLive,
  heatmapActive,
  setHeatmapActive,
  sensorsActive,
  setSensorsActive
}) {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState("active"); // 'active' | 'resolved' | 'all'
  const [activeTab, setActiveTab] = useState("tasks"); // 'tasks' | 'map' | 'profile'
  const [hotspots, setHotspots] = useState([]);
  const [profile, setProfile] = useState(null);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editWorkerName, setEditWorkerName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editStrength, setEditStrength] = useState("");
  const [editGovtId, setEditGovtId] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editOfficeAddress, setEditOfficeAddress] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const loadAssignments = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const [data, profileData] = await Promise.all([
        fetchWorkerAssignments(currentUser),
        fetchWorkerProfile(currentUser)
      ]);
      setEvents(data.events || []);
      setProfile(profileData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const startEditing = (team = null) => {
    if (team) {
      setEditingTeamId(team.id);
      setEditTeamName(team.teamName || "");
      setEditWorkerName(team.workerName || "");
      setEditGender(team.gender || "");
      setEditStrength(team.teamStrength || 1);
      setEditGovtId(team.govtId || "");
      setEditMobile(team.mobile || "");
      setEditOfficeAddress(team.officeAddress || "");
    } else {
      setEditingTeamId("new");
      setEditTeamName("");
      setEditWorkerName("");
      setEditGender("");
      setEditStrength(1);
      setEditGovtId("");
      setEditMobile("");
      setEditOfficeAddress("");
    }
  };

  const cancelEditing = () => {
    setEditingTeamId(null);
  };

  const saveTeam = async () => {
    try {
      const payloadTeam = {
        id: editingTeamId === "new" ? "team_" + Date.now() : editingTeamId,
        teamName: editTeamName,
        workerName: editWorkerName,
        gender: editGender,
        teamStrength: editStrength,
        govtId: editGovtId,
        mobile: editMobile,
        officeAddress: editOfficeAddress
      };

      let currentTeams = profile?.teams || [];
      let updatedTeams;

      if (editingTeamId === "new") {
        updatedTeams = [...currentTeams, payloadTeam];
      } else {
        updatedTeams = currentTeams.map(t => t.id === editingTeamId ? payloadTeam : t);
      }

      const updated = await updateWorkerProfile(currentUser, { teams: updatedTeams });
      setProfile(prev => ({ ...prev, teams: updated.profile.teams }));
      setEditingTeamId(null);
      alert("Team saved successfully!");
    } catch(err) {
      alert("Failed to save team: " + err.message);
    }
  };

  const deleteTeam = async (teamId) => {
    try {
      let currentTeams = profile?.teams || [];
      const newTeams = currentTeams.filter(t => t.id !== teamId);
      const updated = await updateWorkerProfile(currentUser, { teams: newTeams });
      setProfile(prev => ({ ...prev, teams: updated.profile.teams }));
      setConfirmDeleteId(null);
    } catch (err) {
      alert("Failed to delete team: " + err.message);
    }
  };

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

  // --- Render Tabs ---

  const renderDashboardTab = () => (
    <div className="mdl-tab-content">
      <h2 className="mdl-page-title">Dashboard Overview</h2>
      {loading && !profile && (
        <div className="mp-loading">
          <div className="mp-spinner"></div>
        </div>
      )}
      {profile && (
        <div className="mp-dashboard full-dashboard">
          <div className="mp-stat-row">
            <div className="mp-stat mp-stat-critical">
              <span className="mp-stat-value">{activeCount}</span>
              <span className="mp-stat-label">Active Tasks</span>
            </div>
            <div className="mp-stat mp-stat-resolved">
              <span className="mp-stat-value">{resolvedCount}</span>
              <span className="mp-stat-label">Resolved</span>
            </div>
            <div className="mp-stat">
              <span className="mp-stat-value">{events.length}</span>
              <span className="mp-stat-label">Total Assigned</span>
            </div>
            <div className="mp-stat">
              <span className="mp-stat-value">{profile.teamStrength || 1}</span>
              <span className="mp-stat-label">Team Strength</span>
            </div>
          </div>

          {/* Team Info Summary */}
          <div className="mp-stat-row" style={{ marginTop: "20px" }}>
            <div className="mp-stat" style={{ gridColumn: "span 4" }}>
              <span className="mp-stat-label" style={{ marginBottom: "10px" }}>
                Team Info
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", textAlign: "left", width: "100%" }}>
                <div>
                  <span style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Team Name</span>
                  <p style={{ margin: "4px 0 0 0", color: "#e2e8f0" }}>{profile.teamName || "N/A"}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Lead Worker</span>
                  <p style={{ margin: "4px 0 0 0", color: "#e2e8f0" }}>{profile.workerName || "N/A"}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Email</span>
                  <p style={{ margin: "4px 0 0 0", color: "#e2e8f0" }}>{profile.email || "N/A"}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Mobile</span>
                  <p style={{ margin: "4px 0 0 0", color: "#e2e8f0" }}>{profile.mobile || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTasksTab = () => {
    return (
      <div className="mdl-tab-content">
        <div className="mdl-page-header">
          <h2 className="mdl-page-title">My Assignments</h2>
          <div className="mp-filters">
            <select
              className="mp-select mp-status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="active">🔴 Active ({activeCount})</option>
              <option value="resolved">🟢 Resolved ({resolvedCount})</option>
              <option value="all">All ({events.length})</option>
            </select>
            <button
              className="mp-btn mp-btn-secondary mp-refresh-btn"
              onClick={loadAssignments}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading && (
          <div className="mp-loading">
            <div className="mp-spinner"></div>
            <span>Loading assignments...</span>
          </div>
        )}
        {!loading && error && <div className="mp-empty">Error: {error}</div>}
        {!loading && !error && filteredEvents.length === 0 && (
          <div className="mp-empty">
            {filter === "active"
              ? "No active assignments. You're all caught up! 🎉"
              : filter === "resolved"
              ? "No resolved events yet."
              : "No assignments found."}
          </div>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <div className="mp-list">
            {filteredEvents.map((event) => {
              const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.assigned;
              const pollCfg = POLLUTION_TYPES[event.pollutionType] || POLLUTION_TYPES.other;
              const isActing = actionLoading === event.id;
              const assignedTeam = profile?.teams?.find(t => t.id === event.assignedTeamId);

              return (
                <div
                  key={event.id}
                  className={`mp-card mp-event-card severity-${event.severity}`}
                >
                  <div className="mp-priority-strip"></div>

                  {/* Header */}
                  <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{pollCfg.icon}</span>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>{pollCfg.label}</span>
                          {assignedTeam && (
                            <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>
                              Assigned to: {assignedTeam.teamName || "Team"}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className="mp-status-badge"
                        style={{
                          background: `${statusCfg.color}22`,
                          color: statusCfg.color,
                        }}
                      >
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                    </div>

                    {/* Details */}
                    <div style={{ paddingLeft: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontSize: "12px", color: "#4ade80", fontWeight: 600 }}>
                        📍 {event.locationName || "Unknown"}
                      </div>
                      <div style={{ display: "flex", gap: "6px", fontSize: "11px", color: "#64748b", alignItems: "center" }}>
                        <span>{timeAgo(event.timestamp)}</span>
                        <span>•</span>
                        <span style={{ textTransform: "uppercase", fontWeight: 600, fontSize: "10px" }}>{event.severity}</span>
                      </div>
                      {event.text && (
                        <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.4, marginTop: "2px" }}>
                          {event.text.substring(0, 140)}
                          {event.text.length > 140 ? "..." : ""}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mp-actions" style={{ flexDirection: 'column', gap: '8px', padding: '0 8px' }}>
                      {event.status === "assigned" && (
                        <button
                          className="mp-btn mp-btn-primary"
                          disabled={isActing}
                          onClick={() => handleStatusChange(event.id, "worker_en_route")}
                          style={{ width: "100%" }}
                        >
                          🚚 Start Journey
                        </button>
                      )}
                      {event.status === "worker_en_route" && (
                        <button
                          className="mp-btn mp-btn-primary"
                          disabled={isActing}
                          onClick={() => handleStatusChange(event.id, "reached")}
                          style={{ width: "100%" }}
                        >
                          📍 Reached Location
                        </button>
                      )}
                      {event.status === "reached" && (
                        <label className="mp-btn mp-btn-resolve" style={{ cursor: isActing ? 'not-allowed' : 'pointer', textAlign: 'center', display: 'block', width: '100%' }}>
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
                      )}
                      {event.status === "cleanup_done" && (
                        <span style={{ color: '#0ea5e9', fontSize: '12px', fontWeight: 600 }}>🤖 Pending Final Review by Municipality</span>
                      )}
                      {event.status === "resolved" && (
                        <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>✅ Verified & Resolved</span>
                      )}

                      {event.lat && event.lng && (
                         <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="mp-btn mp-btn-secondary"
                            style={{ textAlign: 'center', textDecoration: 'none', display: 'block', width: '100%' }}
                          >
                            🗺️ Navigate
                         </a>
                      )}
                    </div>

                    {isActing && (
                      <div className="mp-action-overlay">
                        <div className="mp-spinner mp-spinner-sm"></div>
                      </div>
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

  const renderMapTab = () => {
    let defaultCenter = { lat: 26.15, lng: 91.75 };
    let defaultZoom = 12;

    const eventsWithCoords = filteredEvents.filter(e => e.lat && e.lng);
    if (eventsWithCoords.length > 0) {
      const sumLat = eventsWithCoords.reduce((sum, e) => sum + parseFloat(e.lat), 0);
      const sumLng = eventsWithCoords.reduce((sum, e) => sum + parseFloat(e.lng), 0);
      defaultCenter = {
        lat: sumLat / eventsWithCoords.length,
        lng: sumLng / eventsWithCoords.length
      };
      defaultZoom = 13;
    }

    return (
      <div className="mdl-tab-content" style={{ height: "calc(100vh - 40px)" }}>
        <h2 className="mdl-page-title">Nearby Hotspots & Tasks</h2>
        <div style={{ height: 'calc(100% - 60px)', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
          <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
            <Map
              defaultZoom={defaultZoom}
              defaultCenter={defaultCenter}
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
        </APIProvider>
        <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
          <span style={{ color: '#ef4444' }}>🔴 Hotspots</span> | <span style={{ color: '#3b82f6' }}>🔵 My Tasks</span>
        </div>
      </div>
    </div>
  );
};

  const renderProfileTab = () => (
    <div className="mdl-tab-content">
      <div className="mdl-page-header">
        <h2 className="mdl-page-title">Team Profile</h2>
        {!editingTeamId && profile && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="mp-btn mp-btn-primary"
              onClick={() => startEditing(null)}
            >
              ➕ Add Team
            </button>
          </div>
        )}
      </div>

      {profile && editingTeamId ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: '#1e293b', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Team Name</label>
            <input 
              type="text" 
              value={editTeamName} 
              onChange={e => setEditTeamName(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Name of the Worker (Lead)</label>
            <input 
              type="text" 
              value={editWorkerName} 
              onChange={e => setEditWorkerName(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Gender</label>
            <select 
              value={editGender} 
              onChange={e => setEditGender(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#0f172a', color: 'white', boxSizing: 'border-box' }}
            >
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Team Strength</label>
            <input 
              type="number" 
              min="1"
              value={editStrength} 
              onChange={e => setEditStrength(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Government ID</label>
            <input 
              type="text" 
              value={editGovtId} 
              onChange={e => setEditGovtId(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Mobile Number</label>
            <input 
              type="text" 
              value={editMobile} 
              onChange={e => setEditMobile(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} 
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Office Address</label>
            <input 
              type="text" 
              value={editOfficeAddress} 
              onChange={e => setEditOfficeAddress(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#0f172a', color: 'white', boxSizing: 'border-box' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', gridColumn: 'span 2' }}>
            <button 
              onClick={saveTeam}
              className="mp-btn mp-btn-primary"
            >Save</button>
            <button 
              onClick={cancelEditing}
              className="mp-btn mp-btn-secondary"
            >Cancel</button>
          </div>
        </div>
      ) : profile && profile.teams && profile.teams.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
          {profile.teams.map((team) => (
            <div key={team.id} style={{ background: '#1e293b', padding: '24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
              {confirmDeleteId === team.id && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '1.2rem' }}>Delete this team?</h3>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="mp-btn mp-btn-danger" onClick={() => deleteTeam(team.id)}>Yes, Delete</button>
                    <button className="mp-btn mp-btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '8px' }}>
                <button
                  className="mp-btn mp-btn-secondary"
                  onClick={() => startEditing(team)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="mp-btn mp-btn-danger"
                  onClick={() => setConfirmDeleteId(team.id)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    padding: '8px 12px'
                  }}
                  title="Delete Team"
                >
                  🗑️
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ margin: '0 0 5px 0', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Team Name</p>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#f8fafc' }}>{team.teamName || "N/A"}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Lead Worker</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>{team.workerName || "N/A"}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Gender</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>{team.gender || "N/A"}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Team Strength</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>{team.teamStrength} Member(s)</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Government ID</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>{team.govtId || "N/A"}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Mobile Number</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>{team.mobile || "N/A"}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 5px 0', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Email</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>{profile.email}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ margin: '0 0 5px 0', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Office Address</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>{team.officeAddress || "N/A"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '8px', marginTop: '20px', textAlign: 'center', color: '#9ca3af' }}>
          No teams found. Click "Add Team" to create one.
        </div>
      )}
    </div>
  );

  // --- Full Screen Layout (same as Municipal) ---
  if (isFullScreen) {
    return (
      <div className={`municipal-dashboard-layout ${activeTab === "map" ? "transparent-layout" : ""}`}>
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
            <h2>VayuAI Field</h2>
          </div>

          <nav className="mdl-nav">
            <button
              className={`mdl-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              <span className="mdl-nav-icon">📊</span>
              Dashboard
            </button>
            <button
              className={`mdl-nav-item ${activeTab === "tasks" ? "active" : ""}`}
              onClick={() => setActiveTab("tasks")}
            >
              <span className="mdl-nav-icon">📋</span>
              My Tasks
              {activeCount > 0 && (
                <span style={{
                  marginLeft: "auto",
                  background: "#f59e0b",
                  color: "#0f172a",
                  borderRadius: "10px",
                  padding: "2px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}>{activeCount}</span>
              )}
            </button>
            <button
              className={`mdl-nav-item ${activeTab === "profile" ? "active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              <span className="mdl-nav-icon">👤</span>
              Team Profile
            </button>
            <button
              className={`mdl-nav-item ${activeTab === "local_map" ? "active" : ""}`}
              onClick={() => setActiveTab("local_map")}
            >
              <span className="mdl-nav-icon">📍</span>
              My Local Area
            </button>

            <div style={{ margin: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}></div>

            <button
              className={`mdl-nav-item ${activeTab === "map" ? "active" : ""}`}
              onClick={() => setActiveTab("map")}
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
                <button
                  className={`mdl-control-btn ${sensorsActive ? "active" : ""}`}
                  onClick={() => setSensorsActive(!sensorsActive)}
                >
                  📡 IoT Sensors
                </button>
              </div>
            )}
          </nav>

          <div className="mdl-sidebar-footer">
            <div className="mdl-user-info">
              <span className="mdl-user-email">{currentUser?.email}</span>
              <span className="mp-badge mp-badge-role" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "fit-content" }}>
                Field Worker
              </span>
            </div>
            <button className="mdl-logout-btn" onClick={onLogout}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="mdl-main">
          {activeTab === "dashboard" && renderDashboardTab()}
          {activeTab === "tasks" && renderTasksTab()}
          {activeTab === "profile" && renderProfileTab()}
          {activeTab === "local_map" && renderMapTab()}
        </div>
      </div>
    );
  }

  // --- Fallback floating panel (for non-fullscreen usage) ---
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
      <div className="wp-content">
        <div className="mp-empty">
          Please use the full-screen dashboard view.
        </div>
      </div>
    </div>
  );
}
