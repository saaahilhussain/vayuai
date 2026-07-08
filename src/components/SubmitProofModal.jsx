import React, { useState, useRef, useCallback, useEffect } from "react";
import "./AddTweetModal.css"; // Reuse modal styles

export default function SubmitProofModal({ isOpen, onClose, onSubmit }) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [imageMeta, setImageMeta] = useState(null);
  const [note, setNote] = useState("");

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Camera error:", err);
      setStatus("error");
      setMessage("Could not access camera.");
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setImageDataUrl(dataUrl);
    setImageMeta({ filename: "camera_capture.jpg", type: "image/jpeg" });
    stopCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (isCameraOpen && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOpen]);

  const handleImageChange = (e) => {
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

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageDataUrl(e.target.result);
      setImageMeta({ filename: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!imageDataUrl) {
      setStatus("error");
      setMessage("Please upload or capture a photo first.");
      return;
    }
    onSubmit(imageDataUrl, note);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="add-tweet-modal glass-panel" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>Submit Resolution Proof</h3>
          <button type="button" className="close-btn" onClick={onClose} disabled={status === "loading"}></button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="form-group">
            <label>Photo/Video Evidence</label>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <span style={{ fontSize: '0.85em', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>📁 Upload File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={status === "loading"}
                />
              </div>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <span style={{ fontSize: '0.85em', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>📸 Capture with Camera</span>
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={status === "loading" || isCameraOpen}
                  style={{ width: '100%', padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Open Camera
                </button>
              </div>
            </div>
            
            {isCameraOpen && (
              <div className="camera-overlay" style={{ marginTop: '15px', position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }}></video>
                <div className="camera-controls" style={{ display: 'flex', gap: '10px', padding: '10px', background: '#1e293b', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={capturePhoto} style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>📸 Take Photo</button>
                  <button type="button" onClick={stopCamera} style={{ background: '#475569', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            
            {imageDataUrl && (
              <div className="image-preview" style={{ marginTop: '15px' }}>
                <img src={imageDataUrl} alt="Selected resolution proof" style={{ maxWidth: '100%', borderRadius: '4px' }} />
                <div className="image-preview-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', fontSize: '12px' }}>
                  <span>{imageMeta?.filename}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl(null);
                      setImageMeta(null);
                    }}
                    disabled={status === "loading"}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Worker Note (Optional)</label>
            <textarea
              placeholder="Provide any details about the resolution..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={status === "loading"}
              rows="3"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: 'white' }}
            />
          </div>

          {message && (
            <div className={`status-message ${status}`}>
              {message}
            </div>
          )}

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
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
              disabled={status === "loading" || !imageDataUrl}
            >
              {status === "loading" ? "Submitting..." : "Submit Proof"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
