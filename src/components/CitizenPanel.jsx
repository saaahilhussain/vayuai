import React, { useState, useEffect, useCallback } from "react";
import "./WorkerPanel.css"; // Reuse styling where possible
import "./MunicipalPanel.css"; // Use mp-* classes for cards
import { useAuth } from "../context/AuthContext";
import { POLLUTION_TYPES, timeAgo, fetchCitizenEvents, submitEventFeedback, deleteCitizenEvent } from "../utils/api";

const STATUS_CONFIG = {
  pending_review: { label: "Under Review", color: "#6b7280", icon: "🕒" },
  open: { label: "Verified", color: "#3b82f6", icon: "✅" },
  assigned: { label: "Assigned", color: "#8b5cf6", icon: "👥" },
  worker_en_route: { label: "Worker En Route", color: "#f59e0b", icon: "🚚" },
  reached: { label: "Worker Reached", color: "#f59e0b", icon: "📍" },
  cleanup_done: { label: "AI Verifying", color: "#0ea5e9", icon: "🤖" },
  resolved: { label: "Completed", color: "#22c55e", icon: "✅" },
};

const EMOJI_SCALE = [
  { rating: "poor", emoji: "😡", label: "Poor" },
  { rating: "bad", emoji: "😞", label: "Bad" },
  { rating: "moderate", emoji: "😐", label: "Moderate" },
  { rating: "good", emoji: "🙂", label: "Good" },
  { rating: "excellent", emoji: "🤩", label: "Excellent" },
];

export default function CitizenPanel({ onClose, globalEvents = [], onRefresh }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(null);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [expandedEventId, setExpandedEventId] = useState(null);

  // Derive citizen events reactively from the live globalEvents array
  const events = globalEvents.filter(e => 
    e.citizenUid === currentUser?.uid || 
    (e.corroboratingCitizenUids && e.corroboratingCitizenUids.includes(currentUser?.uid))
  ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const handleFeedback = async (eventId, rating) => {
    setFeedbackLoading(eventId);
    try {
      await submitEventFeedback(currentUser, eventId, rating);
      // Removed loadEvents; SSE will push the update automatically.
    } catch (err) {
      alert(`Feedback failed: ${err.message}`);
    } finally {
      setFeedbackLoading(null);
    }
  };

  const handleDelete = (eventId) => {
    setDeletingEventId(eventId);
  };

  const confirmDelete = async () => {
    if (!deletingEventId) return;
    try {
      await deleteCitizenEvent(currentUser, deletingEventId);
      // Removed loadEvents; SSE will push the deletion (or we wait for re-render if backend doesn't emit delete).
      setDeletingEventId(null);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="worker-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          top: 'auto',
          right: 'auto',
          width: '95%',
          maxWidth: '900px',
          height: '85vh',
          maxHeight: '85vh',
          margin: '0 auto'
        }}
      >
        <div className="wp-header">
          <div className="wp-header-content">
            <div className="wp-header-title">
              <h3>My Complaints</h3>
              <span className="wp-badge wp-badge-role">Citizen</span>
            </div>
            <span className="wp-subtitle">
              Track the status of your reported pollution incidents
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onRefresh && (
              <button 
                onClick={async () => {
                  setIsRefreshing(true);
                  try { await onRefresh(); } finally { setIsRefreshing(false); }
                }}
                disabled={isRefreshing}
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#3b82f6',
                  cursor: isRefreshing ? 'wait' : 'pointer',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  fontSize: '13px',
                  fontWeight: 500,
                  opacity: isRefreshing ? 0.7 : 1
                }}
                title="Refresh Complaints"
                onMouseOver={(e) => { if(!isRefreshing) { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'; } }}
                onMouseOut={(e) => { if(!isRefreshing) { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; } }}
              >
                {isRefreshing && (
                  <div className="mp-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '6px', borderColor: 'rgba(59, 130, 246, 0.3)', borderTopColor: 'currentColor' }}></div>
                )}
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            )}
            <button className="wp-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

      <div className="wp-content" style={{ padding: '20px' }}>
        {loading && (
          <div className="mp-loading">
            <div className="mp-spinner"></div>
            <span>Loading your complaints...</span>
          </div>
        )}

        {!loading && error && (
          <div className="mp-empty">Error: {error}</div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="mp-empty">
            You haven't reported any pollution incidents yet.
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="mp-list">
            {events.map((event) => {
              const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending_review;
              const pollCfg = POLLUTION_TYPES[event.pollutionType] || POLLUTION_TYPES.other;
              const isFeedbacking = feedbackLoading === event.id;

              return (
                <div 
                  key={event.id} 
                  className={`mp-card mp-event-card severity-${event.severity || 'low'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                >
                  <div className="mp-priority-strip"></div>
                  
                  {/* Header */}
                  <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{pollCfg.icon}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>{pollCfg.label}</span>
                            <span style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                              <span style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                📍 {event.locationName || "Unknown location"}
                              </span>
                              <span>•</span>
                              <span>{timeAgo(event.timestamp)}</span>
                            </span>
                          </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span
                          className="mp-status-badge"
                          style={{
                            background: `${statusCfg.color}22`,
                            color: statusCfg.color,
                          }}
                        >
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                        {event.status !== "resolved" && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                            title="Delete Complaint"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease',
                              fontSize: '14px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          >
                            🗑️
                          </button>
                        )}
                        <span style={{ 
                          marginLeft: '4px', 
                          color: '#64748b', 
                          fontSize: '12px', 
                          transition: 'transform 0.2s', 
                          transform: expandedEventId === event.id ? 'rotate(180deg)' : 'rotate(0deg)' 
                        }}>
                          ▼
                        </span>
                      </div>
                    </div>
                  </div>

                  {expandedEventId === event.id && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', paddingBottom: '14px' }}>
                      {/* Details */}
                      <div style={{ paddingLeft: "22px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace", letterSpacing: "1px" }}>
                          ID: {event.reportId || "PENDING"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#4ade80", fontWeight: 600 }}>
                          📍 {event.locationName || "Unknown"}
                        </div>
                        <div style={{ display: "flex", gap: "6px", fontSize: "11px", color: "#64748b", alignItems: "center" }}>
                          <span>{timeAgo(event.timestamp)}</span>
                          {event.severity && (
                            <>
                              <span>•</span>
                              <span style={{ textTransform: "uppercase", fontWeight: 600, fontSize: "10px" }}>{event.severity}</span>
                            </>
                          )}
                        </div>
                        {event.text && (
                          <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.4, marginTop: "6px", paddingRight: "14px" }}>
                            {event.text}
                          </div>
                        )}
                      </div>

                      {event.status === "resolved" && (
                        <div style={{ paddingLeft: "14px", paddingRight: "14px", marginTop: "12px" }}>
                          {event.resolutionProofUrl && (
                            <div style={{ marginTop: '1rem' }}>
                              <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '8px', fontWeight: 600 }}>
                                ✅ Resolution Proof
                              </div>
                              <img src={event.resolutionProofUrl} alt="Resolution Proof" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a' }} />
                            </div>
                          )}
                          <div className="citizen-feedback-section" style={{ marginTop: '1rem', padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem', textAlign: 'center' }}>
                            {event.feedback ? (
                              <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                                You rated this resolution: <span style={{fontSize: '1.2rem'}}>{EMOJI_SCALE.find(e => e.rating === event.feedback)?.emoji || event.feedback}</span>
                              </div>
                            ) : (
                              <>
                                <div style={{ color: '#e2e8f0', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 500 }}>
                                  How was the cleanup?
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                  {EMOJI_SCALE.map(scale => (
                                    <button
                                      key={scale.rating}
                                      onClick={(e) => { e.stopPropagation(); handleFeedback(event.id, scale.rating); }}
                                      disabled={isFeedbacking}
                                      title={scale.label}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '1.5rem',
                                        cursor: isFeedbacking ? 'not-allowed' : 'pointer',
                                        transition: 'transform 0.1s',
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                      {scale.emoji}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isFeedbacking && (
                    <div className="mp-action-overlay">
                      <div className="mp-spinner mp-spinner-sm"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {deletingEventId && (
        <div className="auth-overlay" onClick={() => setDeletingEventId(null)} style={{ zIndex: 10000 }}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-header">
              <h2>Confirm Deletion</h2>
              <p>Are you sure you want to delete this complaint?</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                className="cb-btn cb-active" 
                style={{ flex: 1, justifyContent: 'center', background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.5)', color: '#f87171' }}
                onClick={confirmDelete}
              >
                Yes, Delete
              </button>
              <button 
                className="cb-btn" 
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setDeletingEventId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
