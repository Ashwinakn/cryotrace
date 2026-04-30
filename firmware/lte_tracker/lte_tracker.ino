/*
 * CryoTrace LTE Tracker — Arduino Firmware
 * 
 * Hardware:
 *   - SIM7600 LTE module (UART)
 *   - DS18B20 temperature sensor (OneWire, pin 4)
 *   - GPS built into SIM7600 (AT+CGPS commands)
 *
 * Libraries needed (install via Arduino Library Manager):
 *   - TinyGSM  (by Volodymyr Shymanskyy)
 *   - ArduinoHttpClient (by Arduino)
 *   - OneWire  (by Paul Stoffregen)
 *   - DallasTemperature (by Miles Burton)
 *
 * Setup:
 *   1. Edit CONFIG section below (APN, SHIPMENT_ID, DEVICE_ID, API_KEY)
 *   2. Flash to Arduino Mega or ESP32
 *   3. Power on — device will connect via LTE and start pushing readings
 */

#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ── CONFIG — edit before flashing ─────────────────────────────────────────────
const char APN[]         = "airtelgprs.com";  // Your carrier's APN
const char GPRS_USER[]   = "";
const char GPRS_PASS[]   = "";

const char SERVER[]      = "your-api.cryotrace.com";  // Replace with your API host
const int  PORT          = 443;                         // 443 for HTTPS, 80 for HTTP
const bool USE_SSL       = true;

// Get these from the CryoTrace admin panel (GET /device/key/{device_id})
const char DEVICE_ID[]   = "LTE-TRACKER-001";
const char SHIPMENT_ID[] = "REPLACE_WITH_SHIPMENT_UUID";
const char API_KEY[]     = "REPLACE_WITH_DEVICE_API_KEY";

const int  PUSH_INTERVAL  = 30000;  // ms — push every 30 seconds
const int  TEMP_SENSOR_PIN = 4;     // DS18B20 data pin

// ── Hardware setup ─────────────────────────────────────────────────────────────
#define SerialMon Serial    // USB Serial for debug output
#define SerialAT  Serial1   // Hardware serial connected to SIM7600 TX/RX

TinyGsm modem(SerialAT);
TinyGsmClientSecure client(modem);
HttpClient http(client, SERVER, PORT);

OneWire           oneWire(TEMP_SENSOR_PIN);
DallasTemperature tempSensor(&oneWire);

// ── State ──────────────────────────────────────────────────────────────────────
float gpsLat       = 0.0;
float gpsLng       = 0.0;
float temperature  = 0.0;
float battery      = 100.0;
int   pushCount    = 0;
bool  gpsReady     = false;

// ── Helper: read GPS from SIM7600 ─────────────────────────────────────────────
bool readGPS() {
  // Enable GPS
  modem.sendAT("+CGPS=1,1");
  if (modem.waitResponse(3000) != 1) return false;

  // Request location
  modem.sendAT("+CGPSINFO");
  String response = "";
  unsigned long timeout = millis() + 5000;
  while (millis() < timeout) {
    if (SerialAT.available()) {
      char c = SerialAT.read();
      response += c;
      if (response.indexOf("OK") >= 0) break;
    }
  }

  // Parse "+CGPSINFO: lat,N/S,lng,E/W,..."
  int idx = response.indexOf("+CGPSINFO:");
  if (idx < 0) return false;

  String data = response.substring(idx + 10);
  data.trim();
  if (data.startsWith(",")) return false;  // no fix yet

  // Very simplified NMEA parse — replace with proper library for production
  float rawLat = data.substring(0, data.indexOf(",")).toFloat();
  gpsLat = (int)(rawLat / 100) + fmod(rawLat, 100.0) / 60.0;
  // Similar for longitude — implement full NMEA parsing here

  return true;
}

// ── Helper: read temperature (DS18B20) ────────────────────────────────────────
float readTemperature() {
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C) {
    SerialMon.println("[Temp] Sensor disconnected!");
    return -999.0;
  }
  return t;
}

// ── Helper: estimate battery from ADC (A0) ────────────────────────────────────
float readBattery() {
  int raw = analogRead(A0);
  // Assumes 3.7V LiPo with 1:2 voltage divider into 5V ADC
  float voltage = raw * (5.0 / 1023.0) * 2.0;
  float pct = constrain((voltage - 3.0) / (4.2 - 3.0) * 100.0, 0, 100);
  return pct;
}

// ── Helper: build JSON payload ────────────────────────────────────────────────
String buildPayload() {
  String ts = "";  // SIM7600 can provide UTC time via AT+CCLK?

  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"shipment_id\":\"" + String(SHIPMENT_ID) + "\",";
  json += "\"temperature\":" + String(temperature, 2) + ",";
  json += "\"lat\":" + String(gpsLat, 6) + ",";
  json += "\"lng\":" + String(gpsLng, 6) + ",";
  json += "\"battery\":" + String(battery, 1) + ",";
  json += "\"door_open\":false,";   // wire a reed switch to a digital pin for real detection
  json += "\"shock\":false,";       // wire an ADXL345 accelerometer for shock detection
  json += "\"lte_provider\":\"" + String(APN) + "\"";
  json += "}";
  return json;
}

// ── Setup ──────────────────────────────────────────────────────────────────────
void setup() {
  SerialMon.begin(115200);
  SerialAT.begin(115200);
  tempSensor.begin();

  SerialMon.println("[CryoTrace] Booting LTE tracker...");

  // Initialize modem
  SerialMon.println("[LTE] Initialising modem...");
  modem.restart();

  String modemInfo = modem.getModemInfo();
  SerialMon.print("[LTE] Modem: "); SerialMon.println(modemInfo);

  // Connect to LTE network
  SerialMon.print("[LTE] Connecting to APN: "); SerialMon.println(APN);
  if (!modem.gprsConnect(APN, GPRS_USER, GPRS_PASS)) {
    SerialMon.println("[LTE] GPRS connection failed! Halting.");
    while (true) delay(1000);
  }
  SerialMon.println("[LTE] Connected!");
  SerialMon.print("[LTE] IP: "); SerialMon.println(modem.localIP());
}

// ── Loop ───────────────────────────────────────────────────────────────────────
void loop() {
  // Read sensors
  temperature = readTemperature();
  battery     = readBattery();
  gpsReady    = readGPS();

  if (temperature == -999.0) {
    SerialMon.println("[Loop] Temp sensor error — skipping push");
    delay(PUSH_INTERVAL);
    return;
  }

  SerialMon.print("[Loop] T="); SerialMon.print(temperature);
  SerialMon.print("°C | GPS=("); SerialMon.print(gpsLat, 4);
  SerialMon.print(","); SerialMon.print(gpsLng, 4);
  SerialMon.print(") | Bat="); SerialMon.print(battery); SerialMon.println("%");

  // Build and POST payload
  String payload = buildPayload();
  String path    = "/device/push";

  http.beginRequest();
  http.post(path);
  http.sendHeader("Content-Type", "application/json");
  http.sendHeader("X-Device-Key", API_KEY);
  http.sendHeader("Content-Length", payload.length());
  http.beginBody();
  http.print(payload);
  http.endRequest();

  int statusCode = http.responseStatusCode();
  String response = http.responseBody();

  SerialMon.print("[HTTP] Status: "); SerialMon.println(statusCode);
  if (statusCode == 200) {
    SerialMon.print("[HTTP] Response: "); SerialMon.println(response);
    pushCount++;
  } else {
    SerialMon.print("[HTTP] Error: "); SerialMon.println(response);
  }

  delay(PUSH_INTERVAL);
}
