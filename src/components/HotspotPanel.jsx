import React, { useState } from 'react';
import "./HotspotPanel.css";
import { POLLUTION_TYPES } from "../utils/api";

export default function HotspotPanel({ hotspots, onClose, onSelectHotspot, onTakeAction }) {
  const [severityFilter, setSeverityFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");
  if (!hotspots || hotspots.length === 0) {
    return null;
  }

  const uniqueWards = Array.from(new Set(hotspots.map(hs => hs.locationName).filter(Boolean)));

  const filteredHotspots = hotspots.filter(hs => {
    if (severityFilter && hs.severity?.toLowerCase() !== severityFilter) return false;
    if (wardFilter && hs.locationName !== wardFilter) return false;
    return true;
  });

  return (
    <div className="hotspot-panel">
      <div className="hp-header">
        <div className="hp-header-content">
          <h3>Active Hotspots</h3>
          <span className="hp-badge">{filteredHotspots.length} detected</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="mp-ward-search" style={{ position: 'relative' }}>
            <input
              type="text"
              list="hotspot-ward-options"
              placeholder="Search Ward..."
              className="mp-select mp-status-filter"
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              style={{ width: '150px' }}
            />
            <datalist id="hotspot-ward-options">
              {uniqueWards.map(ward => (
                <option key={ward} value={ward} />
              ))}
            </datalist>
          </div>
          <select 
            value={severityFilter} 
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="mp-select mp-status-filter"
            style={{ width: '150px' }}
          >
            <option value="">All Severities</option>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="moderate">🟡 Moderate</option>
            <option value="low">🟢 Low</option>
          </select>
          <button className="hp-close-btn" onClick={onClose}>×</button>
        </div>
      </div>
      
      <div className="hp-list">
        {filteredHotspots.map((hs) => {
          const typeInfo = POLLUTION_TYPES[hs.dominantType] || POLLUTION_TYPES.other;
          
          return (
            <div 
              key={hs.id} 
              className={`hp-card severity-${hs.severity}`}
            >
              <div className="hp-rank">#{hs.rank}</div>
              
              <div className="hp-content">
                <div className="hp-row-top">
                  <span className="hp-location">{hs.locationName}</span>
                  <span className="hp-score">Score: {hs.score}</span>
                </div>
                
                <div className="hp-row-mid">
                  <span className="hp-type" style={{ color: typeInfo.color }}>
                    {typeInfo.icon} {typeInfo.label}
                  </span>
                  <span className={`hp-severity-badge sev-${hs.severity}`}>
                    {hs.severity}
                  </span>
                </div>
                
                <div className="hp-row-stats">
                  <span className="hp-stat" title="Number of recent corroborating events">
                    📊 {hs.eventCount} reports
                  </span>
                  <span className="hp-stat" title="Average Confidence">
                    🤖 {Math.round(hs.avgConfidence * 100)}% Conf.
                  </span>
                  {hs.sensorAqi && (
                    <span className="hp-stat" title="Nearest Sensor AQI">
                      📡 AQI {hs.sensorAqi}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button 
                    className="mp-btn mp-btn-secondary" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (onSelectHotspot) onSelectHotspot(hs); 
                    }}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Navigate
                  </button>
                  <button 
                    className="mp-btn mp-btn-primary" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (onTakeAction) onTakeAction(hs.locationName); 
                    }}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Take Action
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
