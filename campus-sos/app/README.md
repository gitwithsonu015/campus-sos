# Expo App (Mobile) — Prototype

This is a minimal Expo React Native app demonstrating the one‑tap SOS flow.

Run:
1. cd app
2. npm install
3. expo start

Notes:
- The app uses a demo header `x-demo-user` to authenticate with the prototype server. In production, replace with proper OAuth/JWT flows.
- Ensure server (server/) is running and update BACKEND_URL in App.js if needed.
- Replace placeholder push token registration with real FCM/APNs integration for push notifications.