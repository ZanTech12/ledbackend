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
});

// API route to toggle LED
app.post("/led", async (req, res) => {
  const { state } = req.body; // "on" or "off"

  // update database
  await LedState.deleteMany({});
  await LedState.create({ led: state });

  // publish to ESP32
  mqttClient.publish("esp32/led", state);

  res.json({ success: true, state });
});

// API route to get LED state
app.get("/led", async (req, res) => {
  const led = await LedState.findOne({});
  res.json(led || { led: "off" });
});

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
