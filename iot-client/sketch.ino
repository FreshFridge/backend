#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHTesp.h>
#include <math.h>

static const int DHT_PIN = 15;
static const int DOOR_PIN = 4;
static const int SERIAL_BAUD = 115200;

static const char* WIFI_SSID = "Wokwi-GUEST";
static const char* WIFI_PASS = "";

static const char* BASE_URL = "https://YOUR_LOAD_BALANCER_HOST";
static const char* IOT_API_KEY = "PASTE_IOT_API_KEY_HERE";
static const char* TELEMETRY_PATH = "/api/iot/telemetry";

static const char* FRIDGE_ID = "AD5501E3-6EFB-4AF6-88B7-C2363EE753C7";

static const unsigned long SEND_INTERVAL_MS = 5000;
static const unsigned long WIFI_RETRY_DELAY_MS = 500;
static const int WIFI_MAX_ATTEMPTS = 40;
static const int HTTP_TIMEOUT_MS = 10000;
static const int HTTP_MAX_ATTEMPTS = 3;

struct TelemetryData {
  float temperature;
  float humidity;
  bool doorOpen;
};

DHTesp dht;
unsigned long lastSendMs = 0;
bool lastDoorOpen = false;

static float roundToOneDecimal(float value) {
  return roundf(value * 10.0f) / 10.0f;
}

static bool isValidDhtReading(float temperature, float humidity) {
  if (isnan(temperature) || isnan(humidity)) return false;
  if (temperature < -40.0f || temperature > 80.0f) return false;
  if (humidity < 0.0f || humidity > 100.0f) return false;
  return true;
}

static bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  for (int attempt = 1; attempt <= WIFI_MAX_ATTEMPTS; attempt++) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("[WiFi] Connected, IP: ");
      Serial.println(WiFi.localIP());
      return true;
    }

    Serial.print("[WiFi] Waiting... ");
    Serial.print(attempt);
    Serial.print("/");
    Serial.println(WIFI_MAX_ATTEMPTS);
    delay(WIFI_RETRY_DELAY_MS);
  }

  Serial.print("[ERROR] WiFi failed, status: ");
  Serial.println(WiFi.status());
  return false;
}

static bool readSensors(TelemetryData& data) {
  TempAndHumidity reading = dht.getTempAndHumidity();

  if (!isValidDhtReading(reading.temperature, reading.humidity)) {
    Serial.println("[ERROR] DHT22 returned invalid data, telemetry skipped");
    return false;
  }

  data.temperature = roundToOneDecimal(reading.temperature);
  data.humidity = roundToOneDecimal(reading.humidity);

  // With INPUT_PULLUP the active switch state is LOW.
  data.doorOpen = digitalRead(DOOR_PIN) == LOW;

  if (data.doorOpen != lastDoorOpen) {
    Serial.print("[Door] State changed: ");
    Serial.println(data.doorOpen ? "OPEN" : "CLOSED");
    lastDoorOpen = data.doorOpen;
  }

  Serial.print("[Sensor] T=");
  Serial.print(data.temperature, 1);
  Serial.print("C H=");
  Serial.print(data.humidity, 1);
  Serial.print("% Door=");
  Serial.println(data.doorOpen ? "OPEN" : "CLOSED");

  return true;
}

static String buildTelemetryBody(const TelemetryData& data) {
  StaticJsonDocument<256> doc;
  doc["fridge_id"] = FRIDGE_ID;
  doc["temperature"] = data.temperature;
  doc["humidity"] = data.humidity;
  doc["door_open"] = data.doorOpen;

  String body;
  serializeJson(doc, body);
  return body;
}

static int postTelemetryOnce(const String& url, const String& body) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, url)) {
    Serial.println("[ERROR] HTTP begin failed");
    return -1;
  }

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", IOT_API_KEY);

  Serial.print("[HTTP] POST ");
  Serial.println(url);
  Serial.print("[HTTP] Body: ");
  Serial.println(body);

  int statusCode = http.POST(body);
  String responseBody = http.getString();

  Serial.print("[HTTP] Status: ");
  Serial.println(statusCode);
  Serial.print("[HTTP] Response: ");
  Serial.println(responseBody.length() > 0 ? responseBody : "<empty>");

  if (statusCode <= 0) {
    Serial.print("[ERROR] HTTP failed: ");
    Serial.println(http.errorToString(statusCode));
  }

  http.end();
  return statusCode;
}

static bool sendTelemetry(const TelemetryData& data) {
  if (!connectWiFi()) {
    Serial.println("[ERROR] Telemetry skipped: WiFi is offline");
    return false;
  }

  const String url = String(BASE_URL) + TELEMETRY_PATH;
  const String body = buildTelemetryBody(data);

  for (int attempt = 1; attempt <= HTTP_MAX_ATTEMPTS; attempt++) {
    Serial.print("[HTTP] Attempt ");
    Serial.print(attempt);
    Serial.print("/");
    Serial.println(HTTP_MAX_ATTEMPTS);

    int statusCode = postTelemetryOnce(url, body);

    if (statusCode >= 200 && statusCode < 300) {
      Serial.println("[HTTP] OK");
      return true;
    }

    Serial.println("[ERROR] Telemetry request was not successful");
    if (attempt < HTTP_MAX_ATTEMPTS) {
      delay(1000);
    }
  }

  Serial.println("[ERROR] Telemetry failed after retries");
  return false;
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(200);

  pinMode(DOOR_PIN, INPUT_PULLUP);
  dht.setup(DHT_PIN, DHTesp::DHT22);

  Serial.println("[System] FreshFridge ESP32 IoT client started");
  Serial.println("[System] DHT22 DATA=GPIO15, Door switch=GPIO4 INPUT_PULLUP");
  Serial.print("[System] Backend: ");
  Serial.println(BASE_URL);
  Serial.print("[System] Endpoint: ");
  Serial.println(TELEMETRY_PATH);

  connectWiFi();
}

void loop() {
  const unsigned long now = millis();
  if (now - lastSendMs < SEND_INTERVAL_MS) {
    delay(20);
    return;
  }
  lastSendMs = now;

  TelemetryData data;
  if (!readSensors(data)) {
    return;
  }

  sendTelemetry(data);
}
