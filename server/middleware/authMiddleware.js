import { adminAuth, adminDb } from "../config/firebaseAdmin.js";

/**
 * Middleware to verify Firebase ID tokens.
 * Extracts token from 'Authorization: Bearer <token>'
 */
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.user = decodedToken;
    
    // Fetch user role from Firestore to attach to req.user
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (userDoc.exists) {
      req.user.role = userDoc.data().role || "citizen";
    } else {
      req.user.role = "citizen";
    }
    
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(403).json({ error: "Unauthorized: Invalid or expired token" });
  }
}

/**
 * Middleware to restrict access to specific roles.
 * Must be used after verifyToken.
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: "Unauthorized: Role not found" });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Forbidden: Requires one of roles [${allowedRoles.join(", ")}]` 
      });
    }
    
    next();
  };
}
