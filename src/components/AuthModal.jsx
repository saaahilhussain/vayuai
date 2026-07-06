import React, { useState } from "react";
import { auth, db } from "../config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import "./AuthModal.css";

export default function AuthModal({ onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createRoleInFirestore = async (user, defaultRole = "citizen") => {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email,
        role: defaultRole,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await createRoleInFirestore(userCred.user, "citizen");
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCred = await signInWithPopup(auth, provider);
      await createRoleInFirestore(userCred.user, "citizen");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>{isLogin ? "Log In to VayuAI" : "Sign Up for VayuAI"}</h2>
        
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleEmailAuth} className="auth-form">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-field"
          />
          <button type="submit" disabled={loading} className="btn-primary auth-submit">
            {loading ? "Processing..." : isLogin ? "Log In" : "Sign Up"}
          </button>
        </form>

        <div className="auth-divider"><span>OR</span></div>

        <button onClick={handleGoogleAuth} disabled={loading} className="btn-secondary google-btn">
          Sign {isLogin ? "in" : "up"} with Google
        </button>

        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => setIsLogin(!isLogin)} className="auth-link">
            {isLogin ? "Sign Up" : "Log In"}
          </span>
        </p>
      </div>
    </div>
  );
}
