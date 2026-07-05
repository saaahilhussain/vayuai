import "./PredictionPanel.css";

function MiniSparkline({ data, maxAqi }) {
  if (!data || data.length === 0) return null;

  const width = 200;
  const height = 30;
  
  // Scale points
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    // Invert Y since SVG 0,0 is top-left
    const y = height - (Math.min(d.predictedAQI, maxAqi) / maxAqi) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width="100%" height="40" viewBox={`0 0 ${width} 40`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth="2"
        points={points}
      />
      {/* Draw peak dot */}
      {data.map((d, i) => {
        if (d.predictedAQI === Math.max(...data.map(x => x.predictedAQI))) {
          const x = (i / (data.length - 1)) * width;
          const y = height - (Math.min(d.predictedAQI, maxAqi) / maxAqi) * height;
          return (
            <circle key={i} cx={x} cy={y} r="4" fill={d.color} />
          );
        }
        return null;
      })}
    </svg>
  );
}

export default function PredictionPanel({ predictionData, onClose, onSelectLocation }) {
  if (!predictionData || !predictionData.locations) {
    return null;
  }

  const { summary, locations } = predictionData;

  const getRiskClass = (risk) => {
    switch(risk?.toLowerCase()) {
      case 'critical': return 'risk-critical';
      case 'high': return 'risk-high';
      case 'moderate': return 'risk-moderate';
      default: return 'risk-low';
    }
  };

  return (
    <div className="prediction-panel">
      <div className="pp-header">
        <div className="pp-header-content">
          <h3>24h AQI Forecast</h3>
          <span className="pp-badge">AI Powered</span>
        </div>
        <button className="pp-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="pp-summary">
        <div className={`pp-risk-banner ${getRiskClass(summary.overallRisk)}`}>
          <span className="pp-risk-label">City-wide Risk Level</span>
          <span className="pp-risk-val">{summary.overallRisk?.toUpperCase()}</span>
        </div>
        
        <div className="pp-summary-stats">
          <div className="pp-stat-box">
            <span className="pp-stat-label">Worst Area</span>
            <span className="pp-stat-val">{summary.worstLocation || "N/A"}</span>
          </div>
          <div className="pp-stat-box">
            <span className="pp-stat-label">Avg Change</span>
            <span className="pp-stat-val">
              {summary.avgChange > 0 ? "+" : ""}{summary.avgChange} AQI
            </span>
          </div>
          <div className="pp-stat-box">
            <span className="pp-stat-label">Danger Zones</span>
            <span className="pp-stat-val">{summary.locationsCrossingDanger} locations &gt; 200</span>
          </div>
          <div className="pp-stat-box">
            <span className="pp-stat-label">Base Weather</span>
            <span className="pp-stat-val">{summary.baseWeather}</span>
          </div>
        </div>
      </div>

      <div className="pp-list">
        {locations.map((loc) => {
          const maxScaleAqi = Math.max(300, loc.peakAQI * 1.1);
          
          return (
            <div 
              key={loc.id} 
              className="pp-card"
              onClick={() => onSelectLocation && onSelectLocation(loc)}
              style={{ borderLeft: `4px solid ${loc.hourlyForecast.find(h => h.predictedAQI === loc.peakAQI)?.color || '#999'}` }}
            >
              <div className="pp-card-header">
                <span className="pp-location">{loc.name}</span>
                <div className="pp-aqi-transition">
                  <span className="pp-aqi-current">{loc.currentAQI}</span>
                  <span className="pp-aqi-arrow">→</span>
                  <span className="pp-aqi-peak" style={{ color: loc.hourlyForecast.find(h => h.predictedAQI === loc.peakAQI)?.color || '#fff' }}>
                    {loc.peakAQI}
                  </span>
                </div>
              </div>

              <div className="pp-card-mid">
                <div className="pp-sparkline">
                  <MiniSparkline data={loc.hourlyForecast} maxAqi={maxScaleAqi} />
                </div>
                <div className="pp-peak-time">
                  <span>Peak at</span>
                  <strong>{String(loc.peakHour).padStart(2, '0')}:00</strong>
                </div>
              </div>

              <div className="pp-factors">
                {loc.factors.map((f, i) => {
                  let impactClass = "impact-neutral";
                  if (f.impact.startsWith("+") || f.impact === "Peak") impactClass = "impact-pos";
                  if (f.impact.startsWith("-")) impactClass = "impact-neg";
                  
                  return (
                    <div key={i} className="pp-factor-chip">
                      <span className={`pp-factor-impact ${impactClass}`}>{f.impact}</span>
                      <span className="pp-factor-desc">{f.description}</span>
                    </div>
                  );
                })}
              </div>

              <div className="pp-confidence" title="Based on data signal strength">
                <span>Confidence</span>
                <div className="pp-conf-bar">
                  <div className="pp-conf-fill" style={{ width: `${loc.confidence}%` }}></div>
                </div>
                <span>{loc.confidence}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
