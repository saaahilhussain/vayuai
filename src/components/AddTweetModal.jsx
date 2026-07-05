import { useState, useEffect, useRef, useCallback } from "react";
import { postCustomTweet, fetchLocations } from "../utils/api";
import "./AddTweetModal.css";

const GUWAHATI_BOUNDS = {
  minLat: 25.95,
  maxLat: 26.35,
  minLng: 91.45,
  maxLng: 92.05,
};

function isInsideGuwahati(lat, lng) {
  return (
    lat >= GUWAHATI_BOUNDS.minLat &&
    lat <= GUWAHATI_BOUNDS.maxLat &&
    lng >= GUWAHATI_BOUNDS.minLng &&
    lng <= GUWAHATI_BOUNDS.maxLng
  );
}

export default function AddTweetModal({
  onClose,
  isPickingLocation,
  pickedLocation,
  onStartPinLocation,
  onCancelPinLocation,
  onClearPickedLocation,
}) {
  const [text, setText] = useState("");
  const [handle, setHandle] = useState("@citizen");
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [imageMeta, setImageMeta] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [message, setMessage] = useState("");
  const hasReportInput = text.trim().length > 0 || Boolean(imageDataUrl);
  
  const [allLocations, setAllLocations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    fetchLocations().then(setAllLocations).catch(console.error);
  }, []);

  const requestBrowserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("manual");
      setMessage("Location detection is unavailable. Pin the report location on the map.");
      return;
    }

    setLocationStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        if (!isInsideGuwahati(coords.lat, coords.lng)) {
          setLocationCoords(null);
          setLocationStatus("manual");
          setMessage("Detected location is outside Guwahati. Pin the report location on the map.");
          return;
        }
        setLocationCoords(coords);
        setLocation("Current location");
        setLocationStatus("detected");
        setMessage("");
      },
      () => {
        setLocationStatus("manual");
        setMessage("Could not detect location. Pin the report location on the map.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(requestBrowserLocation, 0);
    return () => window.clearTimeout(timer);
  }, [requestBrowserLocation]);

  useEffect(() => {
    if (!pickedLocation) return;
    const timer = window.setTimeout(() => {
      setLocationCoords(pickedLocation);
      setLocation("Pinned location");
      setLocationStatus("pinned");
      setMessage("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pickedLocation]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleLocationChange = (e) => {
    const val = e.target.value;
    setLocation(val);
    if (val.trim() && val !== "Current location" && val !== "Pinned location") {
      setLocationCoords(null);
      onClearPickedLocation?.();
      setLocationStatus("manual");
    }
    if (val.length > 0) {
      const filtered = allLocations.filter(loc => loc.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (loc) => {
    setLocation(loc);
    setLocationCoords(null);
    onClearPickedLocation?.();
    setLocationStatus("manual");
    setShowSuggestions(false);
  };

  const resizeImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 1280;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageDataUrl(null);
      setImageMeta(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("Please select an image file.");
      return;
    }

    setStatus("loading");
    setMessage("Preparing image...");
    try {
      const resized = await resizeImage(file);
      setImageDataUrl(resized);
      setImageMeta({
        filename: file.name,
        mimeType: "image/jpeg",
        originalMimeType: file.type,
        originalSize: file.size,
        capturedAt: file.lastModified
          ? new Date(file.lastModified).toISOString()
          : null,
        uploadedAt: new Date().toISOString(),
      });
      setStatus("idle");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Could not prepare the selected image.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasReportInput) return;
    if (!location.trim() && !locationCoords) {
      setStatus("error");
      setMessage("Add a location by detecting your position, selecting a locality, or pinning the report on the map.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await postCustomTweet(
        text,
        handle,
        location,
        imageDataUrl,
        imageMeta,
        locationCoords,
      );

      if (response.accepted) {
        setStatus("success");
        const vision = response.event?.imageAnalysis;
        setMessage(
          vision?.available
            ? `Report submitted. Gemini detected ${vision.pollutionType.replaceAll("_", " ")} (${Math.round(vision.confidence * 100)}%).`
            : "Report submitted and verified!",
        );
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatus("error");
        setMessage(response.reason);
      }
    } catch {
      setStatus("error");
      setMessage("Failed to connect to the server.");
    }
  };

  if (isPickingLocation) {
    return (
      <div className="report-minimized">
        <div>
          <strong>Pick report location</strong>
          <span>Click the main map to place the report pin.</span>
        </div>
        <button type="button" onClick={onCancelPinLocation}>Back</button>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="add-tweet-modal glass-panel">
        <div className="modal-header">
          <h3>Report Pollution</h3>
          <button
            className="close-btn"
            onClick={onClose}
            disabled={status === "loading"}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>User Handle</label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@citizen"
              disabled={status === "loading"}
            />
          </div>

          <div className="form-group" ref={wrapperRef} style={{ position: "relative" }}>
            <label>Location</label>
            <input
              type="text"
              value={location}
              onChange={handleLocationChange}
              onFocus={() => location.length > 0 && setShowSuggestions(true)}
              placeholder="e.g. Fancy Bazaar"
              disabled={status === "loading"}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggestions-dropdown">
                {suggestions.map((sug, i) => (
                  <li key={i} onClick={() => handleSelectSuggestion(sug)}>
                    {sug}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group">
            <div className="location-row">
              <button
                type="button"
                className="btn-location"
                onClick={requestBrowserLocation}
                disabled={status === "loading" || locationStatus === "detecting"}
              >
                {locationStatus === "detecting" ? "Detecting..." : "Use my location"}
              </button>
              {locationCoords && (
                <span className="location-coords">
                  {locationCoords.lat.toFixed(4)}, {locationCoords.lng.toFixed(4)}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-pin-map"
              onClick={onStartPinLocation}
              disabled={status === "loading"}
            >
              Pin on map
            </button>
          </div>

          <div className="form-group">
            <label>Report Content</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="E.g. Thick black smoke from garbage burning near Boragaon right now! Eyes burning, can't breathe. Add a photo if text is brief."
              rows={4}
              disabled={status === "loading"}
            />
          </div>

          <div className="form-group">
            <label>Photo Evidence (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={status === "loading"}
            />
            {imageDataUrl && (
              <div className="image-preview">
                <img src={imageDataUrl} alt="Selected pollution evidence" />
                <div className="image-preview-meta">
                  <span>{imageMeta?.filename}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl(null);
                      setImageMeta(null);
                    }}
                    disabled={status === "loading"}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {message && (
            <div className={`status-message ${status}`}>
              {status === "success" ? "OK: " : status === "error" ? "Rejected: " : ""}
              {message}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={status === "loading"}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={status === "loading" || !hasReportInput}
            >
              {status === "loading"
                ? "Processing..."
                : imageDataUrl
                  ? "Analyze & Submit"
                  : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
