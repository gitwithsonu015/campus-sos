/**
 * Cypress e2e outline for SOS flow.
 * To run:
 *  - Ensure backend is running at http://localhost:3000
 *  - cd tests
 *  - npm install cypress
 *  - npx cypress open
 *
 * This test simulates the app calling the backend endpoints.
 */

describe("SOS Flow", () => {
  const API_BASE = "http://localhost:3000/api";

  it("should create an SOS and then cancel within grace period", () => {
    // Create SOS
    cy.request({
      method: "POST",
      url: `${API_BASE}/sos`,
      headers: { "x-demo-user": "demo-e2e-001" },
      body: { lat: 12.34, lng: 56.78, message: "E2E test SOS" },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      expect(resp.body.alertId).to.exist;
      const alertId = resp.body.alertId;

      // Cancel SOS
      cy.request({
        method: "POST",
        url: `${API_BASE}/sos/cancel`,
        headers: { "x-demo-user": "demo-e2e-001" },
        body: { alertId },
      }).then((cancelResp) => {
        expect(cancelResp.status).to.eq(200);
        expect(cancelResp.body.ok).to.be.true;
      });
    });
  });
});