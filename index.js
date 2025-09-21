require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const mqtt = require("mqtt");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const LedState = mongoose.model("LedState", { led: String });

// HiveMQ client
const mqttClient = mqtt.connect("mqtts://d232a69f6a59447b8481dd9e7637620d.s1.eu.hivemq.cloud:8883", {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});

mqttClient.on("connect", () => {
  console.log("✅ Connected to HiveMQ");

  // Subscribe to ESP32 online status
  mqttClient.subscribe("esp32/status", (err) => {
    if (err) console.error("❌ MQTT Subscribe Error:", err);
    else console.log("📡 Subscribed to esp32/status");
  });
});

// Handle ESP32 reconnect or online message
mqttClient.on("message", async (topic, message) => {
  if (topic === "esp32/status" && message.toString() === "online") {
    console.log("🔄 ESP32 is online - syncing LED state");

    try {
      const led = await LedState.findOne({});
      const state = led?.led || "off";
      mqttClient.publish("esp32/led", state);
      console.log(`📤 Re-sent LED state: ${state}`);
    } catch (err) {
      console.error("❌ Error syncing LED state to ESP32:", err);
    }
  }
});

// API route to toggle LED
app.post("/led", async (req, res) => {
  const { state } = req.body; // "on" or "off"

  try {
    await LedState.deleteMany({});
    await LedState.create({ led: state });

    // publish to ESP32
    mqttClient.publish("esp32/led", state);

    res.json({ success: true, state });
  } catch (err) {
    console.error("❌ LED Toggle Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// API route to get LED state
app.get("/led", async (req, res) => {
  try {
    const led = await LedState.findOne({});
    res.json(led || { led: "off" });
  } catch (err) {
    console.error("❌ Get LED State Error:", err);
    res.status(500).json({ error: "Failed to retrieve LED state" });
  }
});

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
