import "./HotspotPanel.css";
import { POLLUTION_TYPES } from "../utils/api";

export default function HotspotPanel({ hotspots, onClose, onSelectHotspot }) {
  if (!hotspots || hotspots.length === 0) {
    return null;
  }

  return (
    <div className="hotspot-panel">
      <div className="hp-header">
        <div className="hp-header-content">
          <h3>Active Hotspots</h3>
          <span className="hp-badge">{hotspots.length} detected</span>
        </div>
        <button className="hp-close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="hp-list">
        {hotspots.map((hs) => {
          const typeInfo = POLLUTION_TYPES[hs.dominantType] || POLLUTION_TYPES.other;
          
          return (
            <div 
              key={hs.id} 
              className={`hp-card severity-${hs.severity}`}
              onClick={() => onSelectHotspot && onSelectHotspot(hs)}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
