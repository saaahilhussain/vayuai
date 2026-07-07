import React, { useState, useEffect, useCallback } from "react";
import "./WorkerPanel.css"; // Reuse styling where possible
import { useAuth } from "../context/AuthContext";
import { POLLUTION_TYPES, timeAgo, fetchCitizenEvents, submitEventFeedback } from "../utils/api";

const STATUS_CONFIG = {
  pending_review: { label: "Under Review", color: "#6b7280", icon: "🕒" },
  open: { label: "Verified", color: "#3b82f6", icon: "✅" },
  assigned: { label: "Assigned", color: "#8b5cf6", icon: "👥" },
  worker_en_route: { label: "Worker En Route", color: "#f59e0b", icon: "🚚" },
  reached: { label: "Worker Reached", color: "#f59e0b", icon: "📍" },
  cleanup_done: { label: "AI Verifying", color: "#0ea5e9", icon: "🤖" },
  resolved: { label: "Resolved", color: "#22c55e", icon: "🎉" },
};

const EMOJI_SCALE = [
  { rating: "poor", emoji: "😡", label: "Poor" },
  { rating: "bad", emoji: "😞", label: "Bad" },
  { rating: "moderate", emoji: "😐", label: "Moderate" },
  { rating: "good", emoji: "🙂", label: "Good" },
  { rating: "excellent", emoji: "🤩", label: "Excellent" },
];

export default function CitizenPanel({ onClose }) {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(null);

  const loadEvents = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCitizenEvents(currentUser);
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleFeedback = async (eventId, rating) => {
    setFeedbackLoading(eventId);
    try {
      await submitEventFeedback(currentUser, eventId, rating);
      await loadEvents();
    } catch (err) {
      alert(`Feedback failed: ${err.message}`);
    } finally {
      setFeedbackLoading(null);
    }
  };

  return (
    <div className="worker-panel">
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
        <button className="wp-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="wp-filter-tabs">
        <button className="wp-refresh-btn" onClick={loadEvents} title="Refresh">
          ↻ Refresh List
        </button>
      </div>

      <div className="wp-content">
        {loading && (
          <div className="wp-loading">
            <div className="wp-spinner"></div>
            <span>Loading your complaints...</span>
          </div>
        )}

        {!loading && error && (
          <div className="wp-empty">Error: {error}</div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="wp-empty">
            You haven't reported any pollution incidents yet.
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="wp-list">
            {events.map((event) => {
              const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending_review;
              const pollCfg = POLLUTION_TYPES[event.pollutionType] || POLLUTION_TYPES.other;
              const isFeedbacking = feedbackLoading === event.id;

              return (
                <div key={event.id} className={`wp-card severity-${event.severity || 'low'}`}>
                  <div className="wp-card-strip"></div>
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

                  <div className="wp-card-details">
                    <div className="wp-card-location">
                      📍 {event.locationName || "Unknown"}
                    </div>
                    <div className="wp-card-meta">
                      <span>{timeAgo(event.timestamp)}</span>
                      {event.severity && (
                        <>
                          <span>•</span>
                          <span className="wp-severity-tag">{event.severity}</span>
                        </>
                      )}
                    </div>
                    {event.text && (
                      <div className="wp-card-text">
                        {event.text.substring(0, 140)}
                        {event.text.length > 140 ? "..." : ""}
                      </div>
                    )}
                  </div>

                  {event.status === "resolved" && (
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
                                onClick={() => handleFeedback(event.id, scale.rating)}
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
                  )}

                  {isFeedbacking && (
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
