# Emergency Safety & Alert System — Prototype

This repository contains a minimal prototype for a campus SOS app:
- Mobile: Expo React Native app (app/)
- Backend: Node.js + Express + Firestore (server/)
- OpenAPI spec: openapi.yaml
- Firestore rules: firestore.rules
- UI wireframes and acceptance tests included

Important: This is a prototype scaffold. Replace placeholders (Firebase service account, Twilio, FCM) and secure environment variables before production.

Quickstart (local)
1. Prereqs:
   - Node.js 18+
   - Expo CLI (npm i -g expo-cli) for the mobile app
   - Firebase project with Firestore enabled
   - (Optional) Twilio account, FCM/APNs keys for push

2. Backend
   - cd server
   - Copy `.env.example` to `.env` and fill values
   - Place your Firebase service account JSON as `serviceAccountKey.json`
   - npm install
   - npm run dev
   - Server listens on http://localhost:3000

3. Mobile (Expo)
   - cd app
   - npm install
   - expo start
   - Use Expo Go or a simulator to run the app
   - In the app, use the SOS button to POST to the backend

4. Running tests
   - Server unit tests (Jest): cd server && npm test
   - Cypress e2e: cd tests && npm i && npx cypress open (configure baseUrl if needed)

Files included:
- server/: Express server, package.json, .env.example
- app/: Expo app sample (App.js), package.json
- openapi.yaml: API specification
- firestore.rules: Firestore security starter rules
- ui/wireframes.md: UI wireframes + flows
- tests/: Cypress + Jest tests

If you want, I can:
- Commit this scaffold to a GitHub repo for you,
- Generate client SDKs from the OpenAPI spec,
- Add CI (GitHub Actions) to run tests and deploy.
Tell me which and I’ll continue.