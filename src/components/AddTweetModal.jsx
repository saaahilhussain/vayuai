import { useState, useEffect, useRef } from "react";
import { postCustomTweet, fetchLocations } from "../utils/api";
import "./AddTweetModal.css";

export default function AddTweetModal({ onClose }) {
  const [text, setText] = useState("");
  const [handle, setHandle] = useState("@citizen");
  const [location, setLocation] = useState("");
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

    setStatus("loading");
    setMessage("");

    try {
      const response = await postCustomTweet(
        text,
        handle,
        location,
        imageDataUrl,
        imageMeta,
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
        setMessage(`Rejected: ${response.reason}`);
      }
    } catch {
      setStatus("error");
      setMessage("Failed to connect to the server.");
    }
  };

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
            <label>Location (Optional)</label>
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
              {status === "success" ? "✅ " : status === "error" ? "❌ " : ""}
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
