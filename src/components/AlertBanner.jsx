import { useEffect, useState } from 'react';
import { POLLUTION_TYPES, timeAgo } from '../utils/api';
import './AlertBanner.css';

export default function AlertBanner({ event, onDismiss, onSelect }) {
  const [dismissedId, setDismissedId] = useState(null);
  const [expandedState, setExpandedState] = useState({
    id: null,
    expanded: false,
  });
  const expanded =
    expandedState.id === event?.id ? expandedState.expanded : false;
  const visible = event && dismissedId !== event.id;

  useEffect(() => {
    if (!event) return;

    if (Notification.permission === 'granted') {
      try {
        new Notification('VayuAI Alert', {
          body: `${event.locationName || 'Guwahati'} · ${event.text.substring(0, 100)}`,
          icon: '/favicon.svg',
          tag: event.id,
        });
      } catch { /* notification may be blocked */ }
    }
  }, [event]);

  useEffect(() => {
    if (!event || expanded) return undefined;
    const timer = setTimeout(() => {
      setDismissedId(event.id);
      setTimeout(() => onDismiss?.(), 300);
    }, 12000);

    return () => clearTimeout(timer);
  }, [event, expanded, onDismiss]);

  if (!event || !visible) return null;

  const engagement = event.engagement || {};
  const relevancy = event.relevancyScore ? Math.round(event.relevancyScore * 100) : null;

  const handleClick = (e) => {
    e.stopPropagation();
    setExpandedState({ id: event.id, expanded: !expanded });
  };

  return (
    <div
      className={`alert-banner ${expanded ? 'alert-expanded' : ''}`}
      onClick={handleClick}
      id="alert-banner"
    >
      <div className="alert-row">
        <div className="alert-icon" />
        <div className="alert-content">
          <div className="alert-title">
            {event.locationName || 'Guwahati'} · {POLLUTION_TYPES[event.pollutionType]?.label || 'Alert'}
          </div>
          <div className="alert-text">{event.text}</div>
        </div>
        <button className="alert-dismiss" onClick={(e) => { e.stopPropagation(); setDismissedId(event.id); onDismiss?.(); }}>✕</button>
      </div>

      {expanded && (
        <div className="alert-details">
          <div className="alert-detail-row">
            <span className="alert-detail-label">Severity</span>
            <span className={`alert-detail-value alert-sev-${event.severity}`}>{event.severity}</span>
          </div>
          <div className="alert-detail-row">
            <span className="alert-detail-label">Source</span>
            <span className="alert-detail-value">{event.handle || '@unknown'}</span>
          </div>
          <div className="alert-detail-row">
            <span className="alert-detail-label">Time</span>
            <span className="alert-detail-value alert-mono">{timeAgo(event.timestamp)}</span>
          </div>
          {relevancy && (
            <div className="alert-detail-row">
              <span className="alert-detail-label">Relevancy</span>
              <span className="alert-detail-value">{relevancy}%</span>
            </div>
          )}
          <div className="alert-detail-row">
            <span className="alert-detail-label">Engagement</span>
            <span className="alert-detail-value alert-mono">
              {engagement.likes || 0} likes · {engagement.retweets || 0} rt · {engagement.replies || 0} replies
            </span>
          </div>
          <button
            className="alert-locate-btn"
            onClick={(e) => { e.stopPropagation(); onSelect?.(event); }}
          >
            Locate on map
          </button>
        </div>
      )}
    </div>
  );
}
