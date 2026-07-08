import { useState, useEffect, useRef, useCallback } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { postCustomTweet, postVoiceTweet, fetchLocations, aiWriteReport } from "../utils/api";
import { useAuth } from "../context/AuthContext";
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

function AddTweetModalContent({
  onClose,
  isPickingLocation,
  pickedLocation,
  onStartPinLocation,
  onCancelPinLocation,
  onClearPickedLocation,
}) {
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [videoFrames, setVideoFrames] = useState(null); 
  const [imageMeta, setImageMeta] = useState(null);
  const [audioDataUrl, setAudioDataUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("idle"); 
  const [message, setMessage] = useState("");
  const [aiWriteStatus, setAiWriteStatus] = useState("idle"); 
  const [mismatchWarning, setMismatchWarning] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  
  // New State variables for Extended Citizen Report
  const [reporterName, setReporterName] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [state, setStateName] = useState("");
  const [municipalCorp, setMunicipalCorp] = useState("");
  const [wasteCategories, setWasteCategories] = useState([]);
  const [reportDate, setReportDate] = useState(""); // Empty by default
  const [publishConsent, setPublishConsent] = useState(false);

  const toggleCategory = (cat) => {
    setWasteCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const CATEGORY_OPTIONS = [
    "Garbage dump fires",
    "Illegal waste burning",
    "Industrial smoke emissions",
    "Construction dust",
    "Smog accumulation at busy traffic junctions",
    "Localized pollution pockets",
    "Other"
  ];

  
  const hasReportInput = text.trim().length > 0 || Boolean(imageDataUrl) || Boolean(videoFrames) || Boolean(audioDataUrl);
  const { currentUser } = useAuth();
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraMediaRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);

  const [allLocations, setAllLocations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);
  
  const placesLib = useMapsLibrary("places");
  const [autocompleteService, setAutocompleteService] = useState(null);

  useEffect(() => {
    if (placesLib) {
      setAutocompleteService(new placesLib.AutocompleteService());
    }
  }, [placesLib]);
  const geocodingLib = useMapsLibrary("geocoding");
  const [geocoderService, setGeocoderService] = useState(null);

  useEffect(() => {
    if (geocodingLib) {
      setGeocoderService(new geocodingLib.Geocoder());
    }
  }, [geocodingLib]);

  const reverseGeocode = async (coords) => {
    let geocoder = geocoderService;
    if (!geocoder && window.google?.maps?.Geocoder) {
      geocoder = new window.google.maps.Geocoder();
    }
    
    if (geocoder) {
      try {
        const response = await new Promise((resolve, reject) => {
          geocoder.geocode({ location: coords }, (results, status) => {
            if (status === "OK") resolve({ results });
            else reject(new Error(status));
          });
        });
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          
          let extractedCity = "";
          let extractedState = "";
          let extractedPin = "";
          
          result.address_components.forEach(comp => {
            if (comp.types.includes("locality")) extractedCity = comp.long_name;
            if (comp.types.includes("administrative_area_level_1")) extractedState = comp.long_name;
            if (comp.types.includes("postal_code")) extractedPin = comp.long_name;
          });

          const street = result.formatted_address.split(',')[0];
          setLocation(street); 
          if (extractedCity) setCity(extractedCity);
          if (extractedState) setStateName(extractedState);
          if (extractedPin) setPincode(extractedPin);
          return; // Success
        }
      } catch (e) {
        console.warn("Google Geocoding failed, falling back to OSM:", e);
      }
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`);
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      
      if (data && data.address) {
        const { road, town, city, suburb, state, postcode, neighbourhood } = data.address;
        
        const street = road || neighbourhood || suburb || data.display_name.split(',')[0];
        const extractedCity = city || town || suburb || "";
        const extractedState = state || "";
        const extractedPin = postcode || "";

        setLocation(street); 
        if (extractedCity) setCity(extractedCity);
        if (extractedState) setStateName(extractedState);
        if (extractedPin) setPincode(extractedPin);
      }
    } catch (e) {
      console.error("Geocoding failed entirely", e);
      setMessage("Geocoding failed: " + e.message);
    }
  };

  useEffect(() => {
    fetchLocations().then(setAllLocations).catch(console.error);
  }, []);

  const requestBrowserLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("manual");
      setMessage(
        "Location detection is unavailable. Pin the report location on the map.",
      );
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
          setMessage(
            "Detected location is outside Guwahati. Pin the report location on the map.",
          );
          return;
        }
        setLocationCoords(coords);
        setLocation("Current location");
        reverseGeocode(coords);
        setLocationStatus("detected");
        setMessage("");
      },
      () => {
        setLocationStatus("manual");
        setMessage(
          "Could not detect location. Pin the report location on the map.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  // Location auto-detection on mount is disabled per user request

  useEffect(() => {
    if (!pickedLocation) return;
    const timer = window.setTimeout(() => {
      setLocationCoords(pickedLocation);
      setLocation("Pinned location");
      reverseGeocode(pickedLocation);
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
      if (autocompleteService) {
        autocompleteService.getPlacePredictions({
          input: val,
          componentRestrictions: { country: "in" },
          locationBias: {
            north: 26.35,
            south: 25.95,
            west: 91.45,
            east: 92.05,
          }
        }, (predictions, status) => {
          if (status === "OK" && predictions) {
            setSuggestions(predictions.map(p => p.description));
            setShowSuggestions(true);
          } else {
            // Fallback if API fails
            const filtered = allLocations.filter((loc) =>
              loc.toLowerCase().includes(val.toLowerCase()),
            );
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
          }
        });
      } else {
        const filtered = allLocations.filter((loc) =>
          loc.toLowerCase().includes(val.toLowerCase()),
        );
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (sug) => {
    setLocation(sug);
    setShowSuggestions(false);
    
    let geocoder = geocoderService;
    if (!geocoder && window.google?.maps?.Geocoder) {
      geocoder = new window.google.maps.Geocoder();
    }
    
    let googleSuccess = false;
    if (geocoder) {
      try {
        const response = await new Promise((resolve, reject) => {
          geocoder.geocode({ address: sug }, (results, status) => {
            if (status === "OK") resolve({ results });
            else reject(new Error(status));
          });
        });
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          
          const street = result.formatted_address.split(',')[0];
          setLocation(street); 
          
          if (result.geometry?.location) {
            setLocationCoords({
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng()
            });
            setLocationStatus("detected");
          }
          googleSuccess = true;
        }
      } catch (e) {
        console.warn("Google Geocoding from suggestion failed, trying OSM...");
      }
    }
    
    if (!googleSuccess) {
      // Fallback to OSM Nominatim
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(sug + ', India')}&format=json&addressdetails=1&limit=1`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const place = data[0];
            const { road, neighbourhood, suburb } = place.address || {};
            
            const street = road || neighbourhood || suburb || place.display_name.split(',')[0];
            setLocation(street); 
            
            if (place.lat && place.lon) {
              setLocationCoords({
                lat: parseFloat(place.lat),
                lng: parseFloat(place.lon)
              });
              setLocationStatus("detected");
            }
          }
        }
      } catch (e) {
        console.warn("OSM Geocoding failed:", e);
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus("loading");
      setMessage("Processing audio...");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            setAudioDataUrl(reader.result);
            setStatus("idle");
            setMessage("Audio recorded successfully. Ready to submit.");
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setStatus("idle");
        setMessage("Recording... Click again to stop.");
        setAudioDataUrl(null);
        setText(""); // Clear text if recording voice
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage("Could not access microphone.");
      }
    }
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

  const extractVideoFrames = (file) => 
    new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      
      const frames = [];
      const intervalSec = 2; // Extract every 2 seconds
      const maxFrames = 10;
      let currentTime = 0;

      video.onloadedmetadata = () => {
        // Ensure we don't try to seek past duration
        const duration = video.duration;
        
        const captureFrame = () => {
          if (currentTime > duration || frames.length >= maxFrames) {
            URL.revokeObjectURL(url);
            resolve(frames);
            return;
          }

          video.currentTime = currentTime;
        };

        video.onseeked = () => {
          const maxSide = 1024;
          const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          frames.push({
            mimeType: "image/jpeg",
            data: canvas.toDataURL("image/jpeg", 0.7).split(',')[1] // Just get the base64 part for the backend
          });

          currentTime += intervalSec;
          captureFrame();
        };

        video.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(new Error("Video playback error"));
        };

        captureFrame();
      };
      
      video.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load video"));
      };
    });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
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
    setIsVideoRecording(false);
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
    setVideoFrames(null);
    setImageMeta({ filename: "camera_capture.jpg", type: "image/jpeg" });
    stopCamera();
  };

  const toggleVideoRecording = () => {
    if (isVideoRecording) {
      cameraMediaRecorderRef.current.stop();
      setIsVideoRecording(false);
      setStatus("loading");
      setMessage("Processing video...");
    } else {
      try {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        cameraMediaRecorderRef.current = mediaRecorder;
        videoChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) videoChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
          videoBlob.name = "camera_video.webm"; // Mock file name
          try {
            const frames = await extractVideoFrames(videoBlob);
            setVideoFrames(frames);
            setImageDataUrl(null);
            setImageMeta({ filename: "camera_video.webm", type: "video/webm" });
            setStatus("idle");
            setMessage("Video recorded successfully.");
            stopCamera();
          } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage("Failed to process video.");
            stopCamera();
          }
        };

        mediaRecorder.start();
        setIsVideoRecording(true);
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage("Could not start video recording.");
      }
    }
  };

  // Ensure camera stops when unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Attach stream to video element when camera UI opens
  useEffect(() => {
    if (isCameraOpen && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOpen]);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageDataUrl(null);
      setVideoFrames(null);
      setImageMeta(null);
      return;
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setStatus("error");
      setMessage("Please select an image or video file.");
      return;
    }

    setStatus("loading");
    setMessage(file.type.startsWith("video/") ? "Extracting key frames..." : "Preparing image...");
    try {
      if (file.type.startsWith("video/")) {
        const frames = await extractVideoFrames(file);
        setVideoFrames(frames);
        setImageDataUrl(`data:image/jpeg;base64,${frames[0].data}`); // Show first frame as preview
      } else {
        const resized = await resizeImage(file);
        setImageDataUrl(resized);
        setVideoFrames(null);
      }
      
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

  const handleAiWrite = async () => {
    if (!imageDataUrl) return;
    setAiWriteStatus("loading");
    setMismatchWarning("");
    setMessage("");
    setStatus("idle");

    try {
      const result = await aiWriteReport(imageDataUrl, text, location);

      if (!result.success) {
        setStatus("error");
        setMessage(result.error || "AI Write failed.");
        setAiWriteStatus("idle");
        return;
      }

      if (result.scenario === "mismatch" && result.mismatchWarning) {
        setMismatchWarning(result.mismatchWarning);
      }

      setText(result.generatedText);
      setAiWriteStatus("idle");
    } catch {
      setStatus("error");
      setMessage("Could not connect to the AI service.");
      setAiWriteStatus("idle");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasReportInput) return;
    
    if (!text.trim() && !audioDataUrl) {
      setStatus("error");
      setMessage("Please write a description for your report or use the ✨ AI Write button.");
      return;
    }

    if (!location.trim() && !locationCoords) {
      setStatus("error");
      setMessage(
        "Add a location by detecting your position, selecting a locality, or pinning the report on the map.",
      );
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      let response;
      let storageUrl = null;
      if (audioDataUrl) {
        response = await postVoiceTweet(
          audioDataUrl,
          location,
          locationCoords,
          currentUser?.uid
        );
        storageUrl = response.url;
      }

      const detailedLocation = {
        street: location,
        city: city,
        pincode: pincode,
        state: state,
        municipalCorp: municipalCorp
      };

      response = await postCustomTweet(
        text,
        currentUser ? currentUser.email : "@citizen",
        location,
        imageDataUrl,
        videoFrames,
        imageMeta,
        locationCoords,
        storageUrl,
        currentUser ? currentUser.uid : null,
        reporterName,
        detailedLocation,
        wasteCategories,
        reportDate,
        publishConsent
      );

      if (response.accepted) {
        setStatus("success");
        const vision = response.event?.imageAnalysis;
        setMessage("Your report is successfully submitted");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatus("error");
        setMessage(response.reason);
      }
    } catch (error) {
      console.error("Submit error:", error);
      setStatus("error");
      setMessage("Error: " + (error.message || "Failed to connect to the server."));
    }
  };

  if (isPickingLocation) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="add-tweet-modal glass-panel" style={{ maxWidth: '600px', width: '95%', boxSizing: 'border-box', overflowX: 'hidden' }}>
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
            <label>Full Name</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="Enter your full name"
              disabled={status === "loading"}
              required
            />
          </div>

          <div
            className="form-group"
            ref={wrapperRef}
            style={{ position: "relative" }}
          >
            <label>Location</label>
            <input
              value={location}
              onChange={handleLocationChange}
              onFocus={() => location.length > 0 && setShowSuggestions(true)}
              placeholder="Street / Area Name (e.g. Fancy Bazaar)"
              disabled={status === "loading"}
              required
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

          <div className="form-group" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            <input 
              type="text" 
              value={city} 
              onChange={e => setCity(e.target.value)} 
              placeholder="City" 
              disabled={status === "loading"} 
              style={{ flex: '1 1 120px', boxSizing: 'border-box' }} 
              list="city-suggestions"
              required
            />
            <datalist id="city-suggestions">
              <option value="Guwahati" />
              <option value="Dispur" />
              <option value="Dibrugarh" />
              <option value="Silchar" />
              <option value="Jorhat" />
              <option value="Nagaon" />
            </datalist>

            <input 
              type="text" 
              value={pincode} 
              onChange={e => setPincode(e.target.value)} 
              placeholder="Pincode" 
              disabled={status === "loading"} 
              style={{ flex: '1 1 100px', boxSizing: 'border-box' }} 
              maxLength="6"
              pattern="\d{6}"
              required
            />

            <input 
              type="text" 
              value={state} 
              onChange={e => setStateName(e.target.value)} 
              placeholder="State" 
              disabled={status === "loading"} 
              style={{ flex: '1 1 120px', boxSizing: 'border-box' }} 
              list="state-suggestions"
              required
            />
            <datalist id="state-suggestions">
              <option value="Assam" />
              <option value="Meghalaya" />
              <option value="Arunachal Pradesh" />
              <option value="Nagaland" />
              <option value="Manipur" />
              <option value="Mizoram" />
              <option value="Tripura" />
            </datalist>

            <input 
              type="text" 
              value={municipalCorp} 
              onChange={e => setMunicipalCorp(e.target.value)} 
              placeholder="Municipal Corp" 
              disabled={status === "loading"} 
              style={{ flex: '1 1 140px', boxSizing: 'border-box' }} 
              list="municipal-suggestions"
              required
            />
            <datalist id="municipal-suggestions">
              <option value="Guwahati Municipal Corporation" />
              <option value="Dibrugarh Municipal Corporation" />
              <option value="Silchar Municipal Board" />
              <option value="Jorhat Municipal Board" />
              <option value="Tezpur Municipal Board" />
            </datalist>
          </div>

          <div className="form-group">
            <div className="location-row">
              <button
                type="button"
                className="btn-location"
                onClick={requestBrowserLocation}
                disabled={
                  status === "loading" || locationStatus === "detecting"
                }
              >
                {locationStatus === "detecting"
                  ? "Detecting..."
                  : "Use my location"}
              </button>
              {locationCoords && (
                <span className="location-coords">
                  {locationCoords.lat.toFixed(4)},{" "}
                  {locationCoords.lng.toFixed(4)}
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
            <label>Pollution Categories</label>
            <div className="category-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  disabled={status === "loading"}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #4b5563',
                    background: wasteCategories.includes(cat) ? '#3b82f6' : 'transparent',
                    color: wasteCategories.includes(cat) ? '#ffffff' : '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Report Date</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              disabled={status === "loading"}
              min="2026-01-01"
              max="9999-12-31"
              required
            />
          </div>

          <div className="form-group">
            <div className="ai-write-label-row">
              <label>Report Content</label>
              <div style={{display: 'flex', gap: '8px'}}>
                <button
                  type="button"
                  className={`btn-voice ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording}
                  disabled={status === "loading"}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: isRecording ? '#ef4444' : '#1e293b',
                    color: isRecording ? '#ffffff' : '#60a5fa',
                    border: `1px solid ${isRecording ? '#ef4444' : '#3b82f6'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {isRecording ? "⏹ Stop Recording" : "🎤 Voice Report"}
                </button>
                <button
                  type="button"
                  className="btn-ai-write"
                  onClick={handleAiWrite}
                  disabled={
                    !imageDataUrl ||
                    status === "loading" ||
                    aiWriteStatus === "loading"
                  }
                >
                  {aiWriteStatus === "loading" ? "Thinking..." : "✨ AI Write"}
                </button>
              </div>
            </div>
            
            {audioDataUrl && (
              <div className="audio-preview">
                <audio src={audioDataUrl} controls />
                <button type="button" onClick={() => setAudioDataUrl(null)}>Remove Audio</button>
              </div>
            )}

            {!audioDataUrl && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe the pollution issue..."
                rows="3"
                disabled={status === "loading" || isRecording}
              ></textarea>
            )}
            
            {mismatchWarning && (
              <div className="mismatch-warning">
                ⚠️ {mismatchWarning}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Photo/Video Evidence (Optional)</label>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <span style={{ fontSize: '0.85em', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>📁 Upload File</span>
                <input
                  type="file"
                  accept="image/*,video/*"
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
                  <button type="button" onClick={capturePhoto} disabled={isVideoRecording} style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>📸 Take Photo</button>
                  <button type="button" onClick={toggleVideoRecording} style={{ background: isVideoRecording ? '#ef4444' : '#10b981', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                    {isVideoRecording ? "⏹ Stop Recording" : "⏺ Record Video"}
                  </button>
                  <button type="button" onClick={stopCamera} style={{ background: '#475569', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {imageDataUrl && (
              <div className="image-preview">
                <img src={imageDataUrl} alt="Selected pollution evidence" />
                <div className="image-preview-meta">
                  <span>{imageMeta?.filename}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl(null);
                      setVideoFrames(null);
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
              {status === "success" && "OK: "}
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

export default function AddTweetModal(props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === "your_token_here") {
    return <AddTweetModalContent {...props} />;
  }
  return (
    <APIProvider apiKey={apiKey}>
      <AddTweetModalContent {...props} />
    </APIProvider>
  );
}
