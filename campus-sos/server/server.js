/**
 * Minimal SOS backend prototype
 * - Express API: /api/sos, /api/sos/cancel, /api/alerts/:id/acknowledge
 * - Stores alerts in Firestore
 * - Broadcasts via Socket.io
 * - Hooks for Twilio (SMS) and FCM (push)
 *
 * Before running:
 * - Copy .env.example -> .env and fill values
 * - Put Firebase service account JSON at server/serviceAccountKey.json
 */

const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const http = require("http");
const socketio = require("socket.io");
const cors = require("cors");
const twilio = require("twilio");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (e) {
  console.warn("Firebase init failed — make sure serviceAccountKey.json exists for prod usage.");
  admin.initializeApp();
}
const db = admin.firestore();
const fcm = admin.messaging();

// Twilio client (optional)
const TWILIO_SID = process.env.TWILIO_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_FROM || "";
const twClient = TWILIO_SID && TWILIO_TOKEN ? twilio(TWILIO_SID, TWILIO_TOKEN) : null;

// Simple auth middleware (replace with real JWT verification)
app.use((req, res, next) => {
  const auth = (req.headers.authorization || "").replace("Bearer ", "");
  if (!auth) {
    // For prototype allow a demo user via header x-demo-user
    const demo = req.headers["x-demo-user"];
    if (demo) {
      req.user = { id: demo, name: "Demo User", phone: process.env.DEMO_PHONE || "" };
      return next();
    }
    return res.status(401).json({ error: "Unauthorized - provide Bearer token or x-demo-user header for prototype" });
  }
  // TODO: verify JWT and populate req.user
  req.user = { id: auth, name: "User " + auth, phone: "" };
  next();
});

// POST /api/sos
app.post("/api/sos", async (req, res) => {
  try {
    const { lat, lng, accuracy, message } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "Invalid or missing lat/lng" });
    }

    const alertsRef = db.collection("alerts").doc();
    const now = admin.firestore.Timestamp.now();
    const graceSeconds = Number(process.env.GRACE_SECONDS || 30);
    const alert = {
      id: alertsRef.id,
      userId: req.user.id,
      userName: req.user.name,
      location: { lat, lng, accuracy: accuracy || null },
      message: message || "SOS — help needed",
      status: "active",
      createdAt: now,
      graceExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + graceSeconds * 1000),
    };

    await alertsRef.set(alert);

    // Broadcast to connected clients
    io.emit("alert.created", alert);

    // Push notifications: naive: fetch tokens from devices collection for campus subscribers
    try {
      const tokensSnap = await db.collection("devices").where("subscription", "==", "campus").get();
      const tokens = tokensSnap.docs.map(d => d.data().fcmToken).filter(Boolean);
      if (tokens.length) {
        await fcm.sendMulticast({
          tokens,
          notification: {
            title: "Campus SOS",
            body: `${req.user.name}: ${alert.message}`,
          },
          data: { alertId: alert.id, lat: String(lat), lng: String(lng) },
        });
      }
    } catch (err) {
      console.warn("FCM send error (prototype)", err.message);
    }

    // SMS to emergency contacts
    try {
      const contactsSnap = await db.collection("users").doc(req.user.id).collection("contacts").get();
      for (const doc of contactsSnap.docs) {
        const contact = doc.data();
        if (!contact.phone) continue;
        if (!twClient) continue;
        await twClient.messages.create({
          to: contact.phone,
          from: TWILIO_FROM,
          body: `SOS from ${req.user.name}: https://maps.google.com/?q=${lat},${lng} — Please contact emergency services if needed.`,
        });
      }
    } catch (err) {
      console.warn("Twilio send error (prototype)", err.message);
    }

    return res.json({ alertId: alert.id, status: "active" });
  } catch (err) {
    console.error("POST /api/sos error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/sos/cancel
app.post("/api/sos/cancel", async (req, res) => {
  try {
    const { alertId } = req.body;
    if (!alertId) return res.status(400).json({ error: "Missing alertId" });
    const ref = db.collection("alerts").doc(alertId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Alert not found" });
    const data = doc.data();
    if (data.userId !== req.user.id) return res.status(403).json({ error: "Not allowed" });

    await ref.update({ status: "cancelled", cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
    const updated = (await ref.get()).data();
    io.emit("alert.updated", { id: alertId, data: updated });
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/sos/cancel error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/alerts/:id/acknowledge
app.post("/api/alerts/:id/acknowledge", async (req, res) => {
  try {
    const id = req.params.id;
    const ref = db.collection("alerts").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Alert not found" });

    await ref.update({ status: "acknowledged", acknowledgedBy: req.user.id, acknowledgedAt: admin.firestore.FieldValue.serverTimestamp() });
    const updated = (await ref.get()).data();
    io.emit("alert.updated", { id, data: updated });
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/alerts/:id/acknowledge error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SOS backend running on http://localhost:${PORT}`);
});