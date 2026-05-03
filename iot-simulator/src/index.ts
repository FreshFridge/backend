import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

type SimulationMode = "normal" | "bad";

type TelemetryPayload = {
  fridge_id: string;
  temperature: number;
  humidity: number;
  door_open: boolean;
};

const telemetryUrl = process.env.TELEMETRY_URL ?? "http://localhost:3000/api/iot/telemetry";
const explicitJwtToken = process.env.JWT_TOKEN ?? process.env.IOT_JWT_TOKEN;
const jwtSecret = process.env.JWT_ACCESS_SECRET;
const iotUserId = process.env.IOT_USER_ID;
const iotUserEmail = process.env.IOT_USER_EMAIL ?? "iot-device@freshfridge.local";
const fridgeId = process.env.FRIDGE_ID ?? process.env.IOT_FRIDGE_ID;
const simulationMode = (process.env.SIMULATION_MODE ?? "normal") as SimulationMode;
const intervalMs = Number(process.env.SEND_INTERVAL_MS ?? 5000);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 5000);

function log(level: "info" | "error", message: string, meta?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

function randomNumber(min: number, max: number): number {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function randomBoolean(probability = 0.2): boolean {
  return Math.random() < probability;
}

function generateTelemetry(): TelemetryPayload {
  if (simulationMode === "bad") {
    return {
      fridge_id: fridgeId!,
      temperature: randomNumber(12, 24),
      humidity: randomNumber(85, 98),
      door_open: true,
    };
  }

  return {
    fridge_id: fridgeId!,
    temperature: randomNumber(2, 10),
    humidity: randomNumber(30, 80),
    door_open: randomBoolean(),
  };
}

function getJwtToken(): string | null {
  if (explicitJwtToken) {
    return explicitJwtToken;
  }

  if (!jwtSecret || !iotUserId) {
    return null;
  }

  return jwt.sign({ id: iotUserId, email: iotUserEmail, role: "user" }, jwtSecret, {
    expiresIn: "1h",
  });
}

async function sendTelemetry(): Promise<void> {
  const jwtToken = getJwtToken();

  if (!jwtToken || !fridgeId) {
    log(
      "error",
      "Missing token config or fridge id. Provide JWT_TOKEN/IOT_JWT_TOKEN, or JWT_ACCESS_SECRET + IOT_USER_ID, and FRIDGE_ID/IOT_FRIDGE_ID"
    );
    return;
  }

  const payload = generateTelemetry();

  try {
    const response = await axios.post(telemetryUrl, payload, {
      timeout: requestTimeoutMs,
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
      },
    });

    log("info", "Sent telemetry", {
      status: response.status,
      temperature: payload.temperature,
      humidity: payload.humidity,
      doorOpen: payload.door_open,
    });
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    const status = axiosError.response?.status;
    const message =
      axiosError.response?.data?.message ??
      axiosError.response?.data?.error ??
      axiosError.message ??
      "unknown error";

    if (status) {
      log("error", "Telemetry rejected", { status, message });
    } else {
      log("error", "Server unavailable, will retry", { intervalMs, message });
    }
  }
}

log("info", "FreshFridge simulator started");
log("info", "Simulation configured", { simulationMode, intervalMs, telemetryUrl });

void sendTelemetry();
setInterval(() => {
  void sendTelemetry();
}, intervalMs);
