#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHTesp.h>

static const int DHT_PIN = 15;   
static const int DOOR_PIN = 4;  
static const int SERIAL_BAUD = 115200;

static const char* WIFI_SSID = "Wokwi-GUEST";
static const char* WIFI_PASS = "";

static const char* BASE_URL = "https://accordingly-terrorists-justice-portions.trycloudflare.com";
static const char* AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjMzQzEzQTEzLTY5QjgtNDA0RC1CMEQyLUY2RjNDMkYxQzE5RSIsImVtYWlsIjoiYW5uYUB0ZXN0LmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzY2NDEwOTU2LCJleHAiOjE3NjY0MTE4NTZ9.UFpAV1udR6SvwxnF43LhCQl2OL1LApQs_ihKCWS75tE";
static const char* TELEMETRY_PATH = "/api/iot/telemetry";

static const char* FRIDGE_ID = "AD5501E3-6EFB-4AF6-88B7-C2363EE753C7";

static const unsigned long READ_INTERVAL_MS = 5000; 
static const float H_MIN = 35.0f;
static const float H_MAX = 70.0f;

static const unsigned long DOOR_PENALTY_WINDOW_MS = 10UL * 60UL * 1000UL; 
static const float DOOR_K = 0.05f;  

DHTesp dht;
unsigned long lastReadMs = 0;

bool doorOpen = false;
unsigned long doorOpenedAtMs = 0;
unsigned long doorOpenAccumulatedMs = 0;
unsigned long windowStartMs = 0;

static float clampf(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

static bool isValidReading(float t, float h) {
  if (isnan(t) || isnan(h)) return false;
  if (t < -40 || t > 80) return false;
  if (h < 0 || h > 100) return false;
  return true;
}

static float computeRiskScore(float t, float h, float doorOpenSecondsInWindow) {
  const float T_MID = 4.0f;
  const float kT = 10.0f;
  float tempPenalty = clampf(fabs(t - T_MID) * kT, 0.0f, 60.0f);

  const float kH = 0.5f;
  float humOut = 0.0f;
  if (h > H_MAX) humOut = h - H_MAX;
  else if (h < H_MIN) humOut = H_MIN - h;
  float humPenalty = clampf(humOut * kH, 0.0f, 25.0f);

  float doorPenalty = clampf(doorOpenSecondsInWindow * DOOR_K, 0.0f, 15.0f);

  return clampf(tempPenalty + humPenalty + doorPenalty, 0.0f, 100.0f);
}

static void printTelemetry(float t, float h, bool doorOpenNow, float risk, float doorOpenSec) {
  Serial.print("T=");
  Serial.print(t, 1);
  Serial.print("C  H=");
  Serial.print(h, 1);
  Serial.print("%  door=");
  Serial.print(doorOpenNow ? "OPEN" : "CLOSED");
  Serial.print("  door10m=");
  Serial.print(doorOpenSec, 0);
  Serial.print("s  RiskScore=");
  Serial.println(risk, 0);
}

static void wifiConnect() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting WiFi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(250);
    Serial.print(".");
    tries++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi NOT connected (will retry).");
  }
}

static int postTelemetryToServer(float t, float h, bool doorOpenNow) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  HTTPClient http;
  String url = String(BASE_URL) + TELEMETRY_PATH;

  StaticJsonDocument<256> doc;
  doc["fridge_id"] = FRIDGE_ID;
  doc["temperature"] = t;
  doc["humidity"] = h;
  doc["door_open"] = doorOpenNow;

  String body;
  serializeJson(doc, body);

  http.begin(url);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");

  String authHeader = String("Bearer ") + AUTH_TOKEN;
  http.addHeader("Authorization", authHeader);

  int code = http.POST(body);
  String resp = http.getString();
  http.end();

  Serial.print("POST ");
  Serial.print(url);
  Serial.print(" => ");
  Serial.println(code);

  if (resp.length() > 0) {
    Serial.print("Response: ");
    Serial.println(resp);
  }

  return code;
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(200);

  pinMode(DOOR_PIN, INPUT_PULLUP); 
  dht.setup(DHT_PIN, DHTesp::DHT22);

  windowStartMs = millis();

  Serial.println("FreshFridge IoT client (ESP32/Wokwi) started");
  Serial.println("Pins: DHT22=GPIO15, DoorSwitch=GPIO4 (INPUT_PULLUP)");
  Serial.print("Server: ");
  Serial.println(BASE_URL);

  wifiConnect();
}

void loop() {
  const unsigned long now = millis();

  const bool doorOpenNow = (digitalRead(DOOR_PIN) == LOW);

  if (doorOpenNow && !doorOpen) {
    doorOpen = true;
    doorOpenedAtMs = now;
    Serial.println("Door event: OPEN");
  } else if (!doorOpenNow && doorOpen) {
    doorOpen = false;
    doorOpenAccumulatedMs += (now - doorOpenedAtMs);
    Serial.println("Door event: CLOSED");
  }

  if (now - windowStartMs >= DOOR_PENALTY_WINDOW_MS) {
    if (doorOpen) {
      doorOpenAccumulatedMs += (now - doorOpenedAtMs);
      doorOpenedAtMs = now;
    }
    doorOpenAccumulatedMs = 0;
    windowStartMs = now;
  }

  if (WiFi.status() != WL_CONNECTED) {
    wifiConnect();
  }

  if (now - lastReadMs < READ_INTERVAL_MS) {
    delay(10);
    return;
  }
  lastReadMs = now;

  TempAndHumidity th = dht.getTempAndHumidity();
  const float t = th.temperature;
  const float h = th.humidity;

  if (!isValidReading(t, h)) {
    Serial.println("DHT22 read error: invalid data (NaN/out-of-range)");
    return;
  }

  unsigned long openMs = doorOpenAccumulatedMs;
  if (doorOpen) openMs += (now - doorOpenedAtMs);
  const float doorOpenSec = openMs / 1000.0f;

  const float risk = computeRiskScore(t, h, doorOpenSec);

  printTelemetry(t, h, doorOpenNow, risk, doorOpenSec);

  int code = postTelemetryToServer(t, h, doorOpenNow);
  if (code <= 0) {
    Serial.println("Telemetry not sent (no WiFi/server).");
  }
}