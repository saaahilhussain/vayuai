import { useEffect, useRef } from 'react';
import { POLLUTION_TYPES, timeAgo } from '../utils/api';
import './LiveFeed.css';

export default function LiveFeed({ events, onSelectEvent, onClose, isSidebar = false }) {
  const listRef = useRef(null);
  const sorted = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <div className={`live-feed ${isSidebar ? 'sidebar' : ''}`}>
      <div className="feed-header">
        <span className="feed-header-dot" />
        <span className="feed-header-title">Live Feed</span>
        <span className="feed-header-count">{sorted.length}</span>
        {isSidebar && <button className="feed-header-close" onClick={onClose}>✕</button>}
      </div>

      <div className="feed-list" ref={listRef}>
        {sorted.slice(0, 80).map((event) => (
          <div
            key={event.id}
            className="feed-item"
            onClick={() => onSelectEvent?.(event)}
          >
            <div className="feed-item-header">
              <span className={`feed-item-dot ${event.severity}`} />
              <span className="feed-item-handle">{event.handle}</span>
              <span className="feed-item-time">{timeAgo(event.timestamp)}</span>
            </div>
            <div className="feed-item-text">{event.text}</div>
            {event.imageUrl && (
              <div className="feed-item-image">
                <img src={event.imageUrl} alt="" loading="lazy" />
              </div>
            )}
            <div className="feed-item-meta">
              <span className="feed-item-type">
                {POLLUTION_TYPES[event.pollutionType]?.label || 'Unknown'}
              </span>
              {event.fusedConfidence > 0 && (
                <>
                  <span className="feed-item-sep">·</span>
                  <span className="feed-item-fused">
                    {Math.round(event.fusedConfidence * 100)}% conf
                  </span>
                </>
              )}
              {event.corroborationCount > 1 && (
                <>
                  <span className="feed-item-sep">·</span>
                  <span className="feed-item-corroboration">
                    {event.corroborationCount} sources
                  </span>
                </>
              )}
              {event.sensorCorroboration?.corroborates && (
                <>
                  <span className="feed-item-sep">·</span>
                  <span className="feed-item-sensor">
                    AQI {event.sensorCorroboration.aqi}
                  </span>
                </>
              )}
              {event.imageAnalysis?.available && (
                <>
                  <span className="feed-item-sep">·</span>
                  <span className="feed-item-vision">
                    Gemini {Math.round(event.imageAnalysis.confidence * 100)}%
                  </span>
                </>
              )}
              {event.locationName && (
                <>
                  <span className="feed-item-sep">·</span>
                  <span className="feed-item-loc">{event.locationName}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
