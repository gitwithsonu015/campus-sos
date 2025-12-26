import React, { useState, useEffect, useRef } from "react";
import { View, Text, Button, Alert, StyleSheet, TouchableOpacity } from "react-native";
import * as Location from "expo-location";

/**
 * Simple SOS button app:
 * - Press "Send SOS" to capture location and POST to backend
 * - Shows cancel button for grace period
 *
 * Configure BACKEND_URL to point to your server (http://10.0.2.2:3000 or http://localhost:3000 for emulators)
 */

const BACKEND_URL = "http://localhost:3000/api"; // update as needed

export default function App() {
  const [sending, setSending] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [graceLeft, setGraceLeft] = useState(0);
  const graceTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
  }, []);

  async function sendSOS() {
    try {
      setSending(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location required", "Please allow location access to send SOS.");
        setSending(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

      const body = {
        message: "SOS — immediate help needed",
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        ts: new Date().toISOString()
      };

      // For prototype: pass x-demo-user header to identify user (replace with JWT in production)
      const resp = await fetch(`${BACKEND_URL}/sos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-user": "demo-student-001"
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Server error");
      }

      const data = await resp.json();
      setActiveAlertId(data.alertId);
      // Start a local countdown for the grace period (matches server GRACE_SECONDS)
      const grace = 30;
      setGraceLeft(grace);
      graceTimerRef.current = setInterval(() => {
        setGraceLeft(prev => {
          if (prev <= 1) {
            clearInterval(graceTimerRef.current);
            graceTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      Alert.alert("SOS sent", "You have a short window to cancel if this was accidental.");
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to send SOS");
    } finally {
      setSending(false);
    }
  }

  async function cancelSOS() {
    try {
      if (!activeAlertId) return;
      const resp = await fetch(`${BACKEND_URL}/sos/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-user": "demo-student-001"
        },
        body: JSON.stringify({ alertId: activeAlertId })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Server error");
      }
      Alert.alert("Cancelled", "Your SOS has been cancelled.");
      setActiveAlertId(null);
      if (graceTimerRef.current) {
        clearInterval(graceTimerRef.current);
        graceTimerRef.current = null;
      }
      setGraceLeft(0);
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to cancel SOS");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Campus SOS</Text>

      <TouchableOpacity
        style={[styles.sosButton, sending && { opacity: 0.7 }]}
        onPress={sendSOS}
        disabled={sending || !!activeAlertId}
        accessibilityLabel="Send SOS"
      >
        <Text style={styles.sosText}>{sending ? "Sending..." : "SEND SOS"}</Text>
      </TouchableOpacity>

      {activeAlertId ? (
        <View style={styles.cancelBox}>
          <Text style={{ marginBottom: 8 }}>Cancel available for: {graceLeft}s</Text>
          <Button title="Cancel SOS" color="#555" onPress={cancelSOS} />
        </View>
      ) : (
        <Text style={styles.hint}>Press once to send your location to campus safety and your emergency contacts.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  title: { fontSize: 28, marginBottom: 24, fontWeight: "700" },
  sosButton: {
    backgroundColor: "#d11",
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 44,
    marginBottom: 16
  },
  sosText: { color: "white", fontSize: 20, fontWeight: "700" },
  cancelBox: { marginTop: 12, alignItems: "center" },
  hint: { marginTop: 16, color: "#666", textAlign: "center" }
});