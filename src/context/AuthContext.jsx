import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createSessionCookie, clearSessionCookie } from "../utils/api";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'citizen' | 'worker' | 'municipality'
  const [userMunicipality, setUserMunicipality] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Listen to the user's role from Firestore to handle signup race conditions
        unsubDoc = onSnapshot(doc(db, "users", user.uid), async (userDoc) => {
          let role = "citizen";
          let municipality = null;
          if (userDoc.exists()) {
            const data = userDoc.data();
            role = data.role || "citizen";
            municipality = data.municipalityName || null;
          }
          setUserRole(role);
          setUserMunicipality(municipality);
          
          // Store active role in session storage for this tab
          sessionStorage.setItem("activeRole", role);

          // Create the session cookie on the backend
          try {
            const idToken = await user.getIdToken();
            await createSessionCookie(idToken, role);
          } catch (err) {
            console.error("Failed to create session cookie:", err);
          }

          setLoading(false);
        }, (err) => {
          console.error("Error fetching user role:", err);
          setUserRole("citizen");
          setLoading(false);
        });
      } else {
        if (unsubDoc) {
          unsubDoc();
          unsubDoc = null;
        }
        setCurrentUser(null);
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubDoc) unsubDoc();
      unsubscribeAuth();
    };
  }, []);

  const logout = async () => {
    try {
      const currentRole = sessionStorage.getItem("activeRole");
      if (currentRole) {
        await clearSessionCookie(currentRole);
      }
    } catch (err) {
      console.error("Error clearing session cookie:", err);
    } finally {
      sessionStorage.removeItem("activeRole");
      return firebaseSignOut(auth);
    }
  };

  const value = {
    currentUser,
    userRole,
    userMunicipality,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
