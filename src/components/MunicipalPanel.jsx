import React, { useState, useEffect } from "react";
import "./MunicipalPanel.css";
import { fetchMunicipalBrief } from "../utils/api";

const RESOURCE_ICONS = {
  water_cannon: "💦",
  cleanup_crew: "🧹",
  inspection: "📋",
  traffic_police: "🛑",
};

export default function MunicipalPanel({ onClose }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionStates, setActionStates] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMunicipalBrief()
      .then(res => {
        if (!cancelled) {
          setActions(res.actions || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleAction = (idx, type) => {
    setActionStates(prev => ({ ...prev, [idx]: type }));
  };

  return (
    <div className="municipal-panel">
      <div className="mp-header">
        <div className="mp-header-content">
          <div className="mp-header-title">
            <h3>Command Center</h3>
            <span className="mp-badge">AI Brief</span>
          </div>
          <span className="mp-subtitle">Actionable interventions based on live data</span>
        </div>
        <button className="mp-close-btn" onClick={onClose}>×</button>
      </div>

      {loading && (
        <div className="mp-loading">
          <div className="mp-spinner"></div>
          <span>Generating AI Action Brief...</span>
        </div>
      )}

      {!loading && error && (
        <div className="mp-empty">
          Failed to load brief: {error}
        </div>
      )}

      {!loading && !error && actions.length === 0 && (
        <div className="mp-empty">
          No critical actions recommended at this time.
        </div>
      )}

      {!loading && !error && actions.length > 0 && (
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

                <div className="mp-reason">
                  {action.reason}
                </div>

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
}
