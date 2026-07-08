import { adminAuth, adminDb } from "../config/firebaseAdmin.js";

/**
 * Middleware to verify Firebase Session Cookies.
 * Extracts session from req.signedCookies based on 'X-Active-Role' header.
 */
export async function verifyToken(req, res, next) {
  const activeRole = req.headers["x-active-role"];
  
  if (!activeRole) {
    return res.status(401).json({ error: "Unauthorized: No X-Active-Role header provided" });
  }

  const sessionCookie = req.signedCookies[`session_${activeRole}`];

  if (!sessionCookie) {
    return res.status(401).json({ error: `Unauthorized: No active session found for role ${activeRole}` });
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    req.user = decodedClaims;
    
    // Fetch user role from Firestore to attach to req.user
    const userDoc = await adminDb.collection("users").doc(decodedClaims.uid).get();
    if (userDoc.exists) {
      req.user.role = userDoc.data().role || "citizen";
    } else {
      req.user.role = "citizen";
    }
    
    // Safety check: ensure the cookie role matches the actual DB role
    if (req.user.role !== activeRole) {
      return res.status(403).json({ error: "Forbidden: Session role mismatch" });
    }

    next();
  } catch (error) {
    console.error("Error verifying Firebase Session Cookie:", error);
    return res.status(403).json({ error: "Unauthorized: Invalid or expired session cookie" });
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
