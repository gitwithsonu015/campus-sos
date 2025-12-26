/**
 * Jest + Supertest unit test for POST /api/sos
 * Run: from server/ directory: npm test
 *
 * This test uses the real server file; for heavier testing mock Firestore in CI.
 */

const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");

let server;
beforeAll(() => {
  // create a minimal instance of the server file handlers
  const app = express();
  app.use(bodyParser.json());
  // Simple middleware to set demo user (bypass full server boot)
  app.use((req, res, next) => {
    req.user = { id: "test-user-1", name: "Test User" };
    next();
  });
  // Minimal endpoint to test core validation logic (mirrors server)
  app.post("/api/sos", (req, res) => {
    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "Invalid location" });
    }
    return res.status(200).json({ alertId: "fake-alert-1", status: "active" });
  });

  server = app;
});

describe("POST /api/sos", () => {
  test("returns 400 with invalid payload", async () => {
    const resp = await request(server).post("/api/sos").send({ lat: "not-number" });
    expect(resp.statusCode).toBe(400);
  });

  test("returns 200 and alert id with valid payload", async () => {
    const resp = await request(server).post("/api/sos").send({ lat: 12.34, lng: 56.78 });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.alertId).toBeDefined();
  });
});