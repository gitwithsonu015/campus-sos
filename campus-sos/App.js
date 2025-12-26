import React, { useState } from "react";
import { View, Text, Button, Alert, StyleSheet } from "react-native";
import * as Location from "expo-location";
import Constants from "expo-constants";

const BACKEND_URL = "https://your-backend.example.com/api";

export default function App() {
  const [sending, setSending] = useState(false);

  async function sendSOS() {
    try {
      setSending(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Location permission is required to send SOS.");
        setSending(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const body = {
        message: "SOS — immediate help needed",
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        ts: new Date().toISOString(),
      };

      // Replace with real auth token (JWT)
      const token = await getAuthTokenSomehow();

      const resp = await fetch(`${BACKEND_URL}/sos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-app-platform": "expo",
          "x-app-build": Constants.manifest?.releaseChannel || "dev",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Server error: ${text}`);
      }
      const data = await resp.json();
      Alert.alert("SOS Sent", `Alert ID: ${data.alertId}`);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", e.message || "Failed to send SOS");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Campus SOS</Text>
      <Button title={sending ? "Sending..." : "Send SOS"} color="red" onPress={sendSOS} disabled={sending} />
    </View>
  );
}

async function getAuthTokenSomehow() {
  // TODO: implement authentication (SSO / JWT)
  return "REPLACE_WITH_JWT";
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 24, marginBottom: 20 },
});