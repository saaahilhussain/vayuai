import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'citizen' | 'worker' | 'municipality'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          // Fetch the user's role from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || "citizen");
          } else {
            setUserRole("citizen"); // Default fallback
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
          setUserRole("citizen");
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => {
    return firebaseSignOut(auth);
  };

  const value = {
    currentUser,
    userRole,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
