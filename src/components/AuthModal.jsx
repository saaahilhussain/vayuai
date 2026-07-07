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
  const [selectedRole, setSelectedRole] = useState("citizen");
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
        await createRoleInFirestore(userCred.user, selectedRole);
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
      await createRoleInFirestore(userCred.user, selectedRole);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>

        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">🌬️</div>
          <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>
          <p>
            {isLogin
              ? "Sign in to access your VayuAI dashboard"
              : "Join VayuAI to report and track air quality"}
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {/* Form */}
        <form onSubmit={handleEmailAuth} className="auth-form">
          <div className="auth-input-group">
            <span className="auth-input-icon">✉</span>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
              autoComplete="email"
            />
          </div>
          <div className="auth-input-group">
            <span className="auth-input-icon">🔒</span>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-input"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
          {!isLogin && (
            <div className="auth-role-group">
              <label className="auth-role-label">I am signing up as</label>
              <div className="auth-role-options">
                <button
                  type="button"
                  className={`auth-role-btn ${selectedRole === "citizen" ? "auth-role-active" : ""}`}
                  onClick={() => setSelectedRole("citizen")}
                >
                  <span className="auth-role-icon">🧑</span>
                  <span className="auth-role-name">Citizen</span>
                  <span className="auth-role-desc">Report pollution</span>
                </button>
                <button
                  type="button"
                  className={`auth-role-btn ${selectedRole === "worker" ? "auth-role-active" : ""}`}
                  onClick={() => setSelectedRole("worker")}
                >
                  <span className="auth-role-icon">🔧</span>
                  <span className="auth-role-name">Field Worker</span>
                  <span className="auth-role-desc">Resolve issues</span>
                </button>
                <button
                  type="button"
                  className={`auth-role-btn ${selectedRole === "municipality" ? "auth-role-active" : ""}`}
                  onClick={() => setSelectedRole("municipality")}
                >
                  <span className="auth-role-icon">🏛️</span>
                  <span className="auth-role-name">Municipality</span>
                  <span className="auth-role-desc">Manage & assign</span>
                </button>
              </div>
            </div>
          )}
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading && <span className="auth-spinner" />}
            {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="auth-google-btn"
        >
          <svg className="auth-google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Switch */}
        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="auth-link"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </span>
        </p>
      </div>
    </div>
  );
}
