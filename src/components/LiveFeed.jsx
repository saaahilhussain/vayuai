import { useEffect, useRef, useState } from 'react';
import { POLLUTION_TYPES, timeAgo } from '../utils/api';
import './LiveFeed.css';

export default function LiveFeed({ events, onSelectEvent, onClose, isSidebar = false, isEmbedded = false, onRefresh }) {
  const listRef = useRef(null);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const getSortTime = (e) => new Date(e.lastCorroboratedAt || e.lastUpdatedAt || e.timestamp).getTime();
  const sorted = [...events].sort((a, b) => getSortTime(b) - getSortTime(a));

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <div className={`live-feed ${isSidebar ? 'sidebar' : ''} ${isEmbedded ? 'embedded' : ''}`}>
      <div className="feed-header">
        <span className="feed-header-dot" />
        <span className="feed-header-title">Live Feed</span>
        <span className="feed-header-count">{sorted.length}</span>
        {isSidebar && <button className="feed-header-close" onClick={onClose}>✕</button>}
      </div>

      <div 
        className="feed-list" 
        ref={listRef}
        onTouchStart={(e) => {
          if (listRef.current && listRef.current.scrollTop === 0) {
            setStartY(e.touches[0].clientY);
          }
        }}
        onTouchMove={(e) => {
          if (startY === 0 || isRefreshing) return;
          const currentY = e.touches[0].clientY;
          const distance = currentY - startY;
          if (distance > 0 && listRef.current && listRef.current.scrollTop === 0) {
            // Prevent default scroll behavior if possible
            if (e.cancelable) e.preventDefault();
            setPullDistance(Math.min(distance * 0.4, 80));
          }
        }}
        onTouchEnd={async () => {
          if (pullDistance > 60 && onRefresh) {
            setIsRefreshing(true);
            setPullDistance(60);
            await onRefresh();
            setIsRefreshing(false);
          }
          setPullDistance(0);
          setStartY(0);
        }}
      >
        <div className="pull-indicator" style={{ 
          height: pullDistance > 0 ? `${pullDistance}px` : '0', 
          overflow: 'hidden', 
          transition: isRefreshing || pullDistance === 0 ? 'height 0.3s' : 'none', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '0.9em'
        }}>
          {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull down to refresh"}
        </div>
        
        {sorted.slice(0, 80).map((event) => (
          <div
            key={event.id}
            className="feed-item"
            onClick={() => onSelectEvent?.(event)}
          >
            <div className="feed-item-header">
              <span className={`feed-item-dot ${event.severity}`} />
              <span className="feed-item-handle">{event.handle}</span>
              <span className="feed-item-time">{timeAgo(event.lastCorroboratedAt || event.lastUpdatedAt || event.timestamp)}</span>
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
