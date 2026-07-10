import { adminAuth, adminDb } from "../config/firebaseAdmin.js";

// POST /api/auth/session
export async function createSessionCookie(req, res) {
  const { idToken, role } = req.body;

  if (!idToken || !role) {
    return res.status(400).json({ error: "idToken and role are required" });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    
    // Create the session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    
    // Set cookie options
    const options = {
      maxAge: expiresIn,
      httpOnly: true,
      secure: true,
      signed: true,
      sameSite: "none"
    };

    // Use the role to namespace the cookie: "session_citizen", "session_municipality", etc.
    res.cookie(`session_${role}`, sessionCookie, options);
    
    res.json({ success: true, message: `Session created for role: ${role}` });
  } catch (error) {
    console.error("Session creation error:", error);
    res.status(401).json({ error: "UNAUTHORIZED REQUEST!" });
  }
}

// POST /api/auth/logout
export async function logoutSession(req, res) {
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: "role is required" });
  }

  res.clearCookie(`session_${role}`);
  res.json({ success: true, message: `Session cleared for role: ${role}` });
}
