const express = require("express");
const admin = require("firebase-admin"); // Firestore + FCM
const http = require("http");
const socketio = require("socket.io");
const bodyParser = require("body-parser");
const twilio = require("twilio");

// Initialize Firebase Admin SDK with service account JSON
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});
const db = admin.firestore();
const fcm = admin.messaging();

const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM;
const tw = twilio(TWILIO_SID, TWILIO_TOKEN);

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

app.use(bodyParser.json());

// simple auth middleware (replace with real JWT verification)
app.use(async (req, res, next) => {
  const auth = (req.headers.authorization || "").replace("Bearer ", "");
  if (!auth) return res.status(401).send("Unauthorized");
  try {
    // TODO: verify JWT, set req.user
    req.user = { id: "user123", name: "Demo Student", phone: "+15551234567" };
    next();
  } catch (e) {
    res.status(401).send("Unauthorized");
  }
});

app.post("/api/sos", async (req, res) => {
  try {
    const { lat, lng, accuracy, message } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") return res.status(400).send("Invalid location");

    const alertRef = db.collection("alerts").doc();
    const alert = {
      id: alertRef.id,
      userId: req.user.id,
      userName: req.user.name,
      location: { lat, lng, accuracy: accuracy || null },
      message: message || "SOS",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      graceExpiresAt: new Date(Date.now() + 30 * 1000), // 30 seconds to cancel
    };
    await alertRef.set(alert);

    // Broadcast via Socket.io
    io.emit("alert.created", { id: alert.id, ...alert });

    // Send push to all FCM tokens in campus (naive: fetch tokens from 'devices' collection)
    const tokensSnap = await db.collection("devices").where("subscription", "==", "campus").get();
    const tokens = tokensSnap.docs.map(d => d.data().fcmToken).filter(Boolean);
    if (tokens.length) {
      await fcm.sendMulticast({
        tokens,
        notification: {
          title: "Campus SOS — immediate assistance needed",
          body: `${req.user.name}: ${message || "SOS"} — tap to view`,
        },
        data: { alertId: alert.id, lat: String(lat), lng: String(lng) },
      });
    }

    // Send SMS to user's emergency contacts
    const contactsSnap = await db.collection("users").doc(req.user.id).collection("contacts").get();
    for (const c of contactsSnap.docs) {
      const contact = c.data();
      if (!contact.phone) continue;
      try {
        await tw.messages.create({
          to: contact.phone,
          from: TWILIO_FROM,
          body: `SOS from ${req.user.name} at https://maps.google.com/?q=${lat},${lng}. Please call emergency services if necessary.`,
        });
      } catch (err) {
        console.warn("Twilio error", err.message);
      }
    }

    res.json({ alertId: alert.id, status: "active" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Admin or responder acknowledges
app.post("/api/alerts/:id/acknowledge", async (req, res) => {
  const id = req.params.id;
  const ref = db.collection("alerts").doc(id);
  await ref.update({ status: "acknowledged", acknowledgedBy: req.user.id, acknowledgedAt: admin.firestore.FieldValue.serverTimestamp() });
  const doc = await ref.get();
  io.emit("alert.updated", { id, data: doc.data() });
  res.send("ok");
});

server.listen(process.env.PORT || 3000, () => console.log("Server listening"));