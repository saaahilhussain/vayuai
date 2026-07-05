# Firebase Integration & RBAC Architecture Plan

To transform VayuAI from a prototype into a production-ready system with Role-Based Access Control (RBAC), we will integrate Firebase. This will introduce three distinct roles:
1. **Citizens:** Submit pollution reports.
2. **Field Workers:** Receive assignments, travel to hotspots, and upload proof of resolution (images).
3. **Municipality:** View the Command Center, assign tasks to workers, and perform CRUD operations to manage the lifecycle of pollution events (Open -> In Progress -> Resolved).

Since this is a major architectural shift, it is divided into manageable phases:

## Phase 0: Backend MVC Refactoring (Pre-requisite)
**Goal:** Restructure the monolithic `server/index.js` into a clean, modular MVC (Model-View-Controller) architecture to prepare for Firebase integration.
- **Folder Structure:** Create `models`, `routes`, `controllers`, and `services` directories inside the `server/` folder.
- **Services Migration:** Move all AI and logic engines (`nlpPipeline.js`, `imageAnalysis.js`, `geocoder.js`, `hotspotEngine.js`, `municipalEngine.js`, `predictionEngine.js`, `sensorGrid.js`, `translator.js`, `weatherService.js`, `fakeData.js`) into the `server/services/` folder.
- **Controllers Migration:** Extract route handler logic (e.g., `processTweetDetailed`, `/api/stats`, `/api/heatmap`) from `index.js` into dedicated files like `server/controllers/eventController.js` and `server/controllers/tweetController.js`.
- **Routes Migration:** Define API route definitions in `server/routes/` and mount them in `index.js` (e.g., `app.use('/api', apiRoutes)`).
- **Models Migration:** Move `eventStore.js` to `server/models/eventStore.js` (this will eventually be replaced by Firestore in Phase 2).

## Phase 1: Firebase Foundation & Authentication Setup
**Goal:** Establish the Firebase project and implement the login system with RBAC.
- **Firebase Init:** Set up Firebase Auth, Firestore, and Storage.
- **Frontend Auth:** Implement a Login/Signup Modal (Email/Password or Google).
- **RBAC Schema (Firestore):** Create a `users` collection mapping `uid` to `{ role: "citizen" | "worker" | "municipality", name, email }`.
- **Backend Auth:** Add `firebase-admin` to the Express server to verify ID tokens via middleware on protected `/api/*` routes.

## Phase 2: Database Migration (Firestore)
**Goal:** Replace the current in-memory `eventStore.js` with persistent Firestore data.
- **Data Modeling:** 
  - Migrate pollution events to an `events` collection.
  - Add fields for lifecycle management: `status` (open, in_progress, resolved), `assignedTo` (worker uid), `resolutionProofUrl`.
- **Backend Refactoring:** Update `server/index.js` to read/write events directly to Firestore instead of the local array. The Gemini analysis pipeline remains intact but saves results to Firestore.

## Phase 3: Media Storage Migration
**Goal:** Replace base64 data URLs with scalable cloud storage.
- **Firebase Storage Integration:** Update the frontend `AddTweetModal` to upload images/videos directly to Firebase Storage first.
- **Payload Update:** Pass the resulting Firebase Storage download URL to the Express backend instead of massive base64 strings, significantly improving network performance.

## Phase 4: Municipality Command Center (CRUD)
**Goal:** Empower municipal authorities with full control over the city's events.
- **Dashboard Enhancements:** Secure the Command Center (`MunicipalPanel.jsx`) so it is only visible to users with the `municipality` role.
- **Task Assignment UI:** Allow the municipality to select a detected hotspot/event and assign it to a specific `worker` via a dropdown menu.
- **CRUD Operations:** Allow the municipality to manually override event statuses, delete spam reports, or close out verified resolved issues.

## Phase 5: Field Worker Workflow
**Goal:** Enable field workers to receive and resolve assigned tasks.
- **Worker View:** Create a dedicated "My Tasks" panel for users with the `worker` role.
- **Proof of Work:** Field workers click on an assigned task, travel to the location, and upload an image showing the resolved issue (e.g., a extinguished fire or cleared garbage dump).
- **Resolution Loop:** The uploaded image is verified (optionally by Gemini AI or manually by the Municipality), and the event status is updated to `resolved`. The event is then cleared from the active map.

---

## Open Questions for You:
1. **Firebase Project:** Do you already have a Firebase project created, or will we need to initialize a fresh configuration during Phase 1?
2. **Current UI:** Should the Field Worker and Municipality views remain as overlays on the main 3D Map, or should we build dedicated routes/pages for them?
3. **Backend Preference:** Do we want to keep the current Express.js Node server running alongside Firebase (best for keeping our Gemini logic intact), or migrate the backend logic entirely into Firebase Cloud Functions? (I recommend keeping Express for simplicity).
