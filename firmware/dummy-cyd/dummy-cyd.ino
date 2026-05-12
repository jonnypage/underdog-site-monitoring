/**
 * dummy-cyd.ino
 *
 * Dummy sensor node for the "Cheap Yellow Display" (ESP32-2432S028 / CYD).
 * - Posts fake aquaponics sensor data to the Underdog /ingest endpoint.
 * - Touchscreen button toggles between healthy and unhealthy data ranges.
 * - Display sleeps (backlight off) after SLEEP_TIMEOUT_MS of inactivity.
 * - Any touch wakes the display.
 *
 * Hardware: ESP32-2432S028R (CYD)
 *   TFT:   ILI9341  (SPI, 320x240)
 *   Touch: XPT2046  (SPI, shared bus with TFT but different CS/IRQ)
 *
 * Required libraries (install via Arduino Library Manager):
 *   - TFT_eSPI         (Bodmer)  — configure for CYD, see User_Setup.h notes below
 *   - XPT2046_Touchscreen  (Paul Stoffregen)
 *
 * TFT_eSPI User_Setup.h for CYD (place in TFT_eSPI library folder):
 *   #define ILI9341_DRIVER
 *   #define TFT_WIDTH  240
 *   #define TFT_HEIGHT 320
 *   #define TFT_MISO 12
 *   #define TFT_MOSI 13
 *   #define TFT_SCLK 14
 *   #define TFT_CS   15
 *   #define TFT_DC    2
 *   #define TFT_RST  -1
 *   #define TFT_BL   21   // backlight
 *   #define TFT_BACKLIGHT_ON HIGH
 *   #define LOAD_GLCD
 *   #define LOAD_FONT2
 *   #define LOAD_FONT4
 *   #define SPI_FREQUENCY  55000000
 *   #define SPI_READ_FREQUENCY  20000000
 *   #define SPI_TOUCH_FREQUENCY  2500000
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <SPI.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>

// ==========================================
// CONFIGURATION — edit these
// ==========================================
const char* ssid       = "YOUR_WIFI_SSID";
const char* password   = "YOUR_WIFI_PASSWORD";
const char* apiBaseUrl = "https://api.underdog.pocketsized.ca/ingest";
const char* deviceId   = "device-123";
const char* apiKey     = "YOUR_PLAINTEXT_API_KEY";

// How often to post data (ms). Must be >= 5000 to avoid rate-limiting.
const unsigned long POST_INTERVAL_MS = 15000;

// Backlight sleep timeout (ms of no touch)
const unsigned long SLEEP_TIMEOUT_MS = 30000;
// ==========================================

// ── CYD Touch pins ─────────────────────────
#define TOUCH_CS  33
#define TOUCH_IRQ 36   // T_IRQ on CYD — INPUT only GPIO

// ── Backlight pin ──────────────────────────
#define TFT_BACKLIGHT_PIN 21

// ── Display / touch objects ────────────────
TFT_eSPI tft = TFT_eSPI();
XPT2046_Touchscreen ts(TOUCH_CS, TOUCH_IRQ);

// ── State ──────────────────────────────────
bool sendNormal       = true;   // toggled by touch button
bool displayAwake     = true;
unsigned long lastTouchMs  = 0;
unsigned long lastPostMs   = 0;
bool lastPostSuccess  = false;
String lastPostTime   = "--:--";
int postCount         = 0;

// ── Touch calibration (raw → pixel) ────────
// These are typical CYD values; adjust if touch feels off.
// Portrait: x maps to TFT Y, y maps to TFT X (driver rotates)
const int TOUCH_X_MIN = 200,  TOUCH_X_MAX = 3700;
const int TOUCH_Y_MIN = 200,  TOUCH_Y_MAX = 3800;
const int SCREEN_W    = 320,  SCREEN_H    = 240;

// Toggle button bounds (landscape)
const int BTN_X = 60,  BTN_Y = 80, BTN_W = 200, BTN_H = 60;

// ── Colors ─────────────────────────────────
#define C_BG        TFT_BLACK
#define C_ACCENT    0x04B5   // teal-ish
#define C_GREEN     0x07E0
#define C_RED       0xF800
#define C_ORANGE    0xFD20
#define C_WHITE     TFT_WHITE
#define C_GREY      0x7BEF
#define C_DARKGREY  0x39E7

// ───────────────────────────────────────────
// Screen drawing helpers
// ───────────────────────────────────────────

void drawStatusBar() {
  tft.fillRect(0, 0, SCREEN_W, 30, C_ACCENT);
  tft.setTextColor(C_WHITE, C_ACCENT);
  tft.setTextSize(1);
  tft.drawString("Underdog Dummy Node", 8, 8, 2);

  // WiFi indicator dot
  bool wifiOk = (WiFi.status() == WL_CONNECTED);
  tft.fillCircle(SCREEN_W - 14, 15, 6, wifiOk ? C_GREEN : C_RED);
}

void drawToggleButton() {
  uint16_t btnColor = sendNormal ? C_GREEN : C_RED;
  tft.fillRoundRect(BTN_X, BTN_Y, BTN_W, BTN_H, 10, btnColor);
  tft.drawRoundRect(BTN_X, BTN_Y, BTN_W, BTN_H, 10, C_WHITE);

  tft.setTextColor(C_WHITE, btnColor);
  tft.setTextSize(1);
  if (sendNormal) {
    tft.drawCentreString("HEALTHY DATA", BTN_X + BTN_W / 2, BTN_Y + 10, 2);
    tft.drawCentreString("(tap to send BAD)", BTN_X + BTN_W / 2, BTN_Y + 34, 1);
  } else {
    tft.drawCentreString("UNHEALTHY DATA", BTN_X + BTN_W / 2, BTN_Y + 10, 2);
    tft.drawCentreString("(tap to send GOOD)", BTN_X + BTN_W / 2, BTN_Y + 34, 1);
  }
}

void drawStats() {
  // Clear stats area
  tft.fillRect(0, 155, SCREEN_W, SCREEN_H - 155, C_BG);

  tft.setTextColor(C_GREY, C_BG);
  tft.setTextSize(1);

  tft.drawString("Last post:", 10, 160, 2);
  tft.setTextColor(lastPostSuccess ? C_GREEN : C_RED, C_BG);
  tft.drawString(lastPostSuccess ? "OK  " : "ERR ", 115, 160, 2);
  tft.setTextColor(C_WHITE, C_BG);
  tft.drawString(lastPostTime, 160, 160, 2);

  tft.setTextColor(C_GREY, C_BG);
  tft.drawString("Posts sent:", 10, 185, 2);
  tft.setTextColor(C_WHITE, C_BG);
  tft.drawString(String(postCount), 115, 185, 2);

  tft.setTextColor(C_GREY, C_BG);
  tft.drawString("IP:", 10, 210, 2);
  tft.setTextColor(C_WHITE, C_BG);
  tft.drawString(
    WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "Not connected",
    40, 210, 2
  );
}

void drawFullScreen() {
  tft.fillScreen(C_BG);
  drawStatusBar();
  drawToggleButton();
  drawStats();
}

// ───────────────────────────────────────────
// Backlight / sleep
// ───────────────────────────────────────────

void setBacklight(bool on) {
  digitalWrite(TFT_BACKLIGHT_PIN, on ? HIGH : LOW);
  displayAwake = on;
}

void wakeDisplay() {
  if (!displayAwake) {
    setBacklight(true);
    drawFullScreen();
  }
  lastTouchMs = millis();
}

// ───────────────────────────────────────────
// Touch helpers
// ───────────────────────────────────────────

// Map raw touch coordinates to screen pixels (landscape orientation)
bool getTouchPixel(int &px, int &py) {
  if (!ts.touched()) return false;
  TS_Point p = ts.getPoint();

  // Map raw values; CYD in landscape typically needs X/Y swap
  px = map(p.y, TOUCH_Y_MIN, TOUCH_Y_MAX, 0, SCREEN_W);
  py = map(p.x, TOUCH_X_MIN, TOUCH_X_MAX, 0, SCREEN_H);

  px = constrain(px, 0, SCREEN_W - 1);
  py = constrain(py, 0, SCREEN_H - 1);
  return true;
}

bool insideButton(int px, int py) {
  return px >= BTN_X && px <= (BTN_X + BTN_W) &&
         py >= BTN_Y && py <= (BTN_Y + BTN_H);
}

// ───────────────────────────────────────────
// NTP + timestamp
// ───────────────────────────────────────────

String getIso8601Time() {
  time_t now = time(nullptr);
  struct tm ti;
  gmtime_r(&now, &ti);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &ti);
  return String(buf);
}

String getShortTime() {
  time_t now = time(nullptr);
  struct tm ti;
  localtime_r(&now, &ti);
  char buf[10];
  strftime(buf, sizeof(buf), "%H:%M:%S", &ti);
  return String(buf);
}

// ───────────────────────────────────────────
// API posting
// ───────────────────────────────────────────

void postData() {
  if (WiFi.status() != WL_CONNECTED) {
    lastPostSuccess = false;
    lastPostTime = getShortTime();
    drawStats();
    return;
  }

  float temp, ph, waterLevel, do_val;

  if (sendNormal) {
    temp       = 20.0 + (random(0, 100) / 10.0);  // 20–30
    ph         = 6.5  + (random(0, 20)  / 10.0);  // 6.5–8.5
    waterLevel = 70.0 + random(0, 30);             // 70–100
    do_val     = 5.0  + (random(0, 30)  / 10.0);  // 5–8
  } else {
    temp       = 35.0 + (random(0, 50)  / 10.0);  // 35–40
    ph         = 4.0  + (random(0, 10)  / 10.0);  // 4–5
    waterLevel = 40.0 + random(0, 10);             // 40–50
    do_val     = 2.0  + (random(0, 10)  / 10.0);  // 2–3
  }

  String timestamp = getIso8601Time();

  String payload = "{";
  payload += "\"deviceId\":\"" + String(deviceId) + "\",";
  payload += "\"timestamp\":\"" + timestamp + "\",";
  payload += "\"readings\":{";
  payload += "\"temperature\":"     + String(temp, 2)       + ",";
  payload += "\"ph\":"              + String(ph, 2)          + ",";
  payload += "\"waterLevel\":"      + String(waterLevel, 2)  + ",";
  payload += "\"dissolvedOxygen\":" + String(do_val, 2);
  payload += "}}";

  Serial.println("POST → " + payload);

  WiFiClientSecure client;
  client.setInsecure(); // skip cert validation for simple testing
  HTTPClient http;

  bool ok = false;
  if (http.begin(client, apiBaseUrl)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", apiKey);

    int code = http.POST(payload);
    ok = (code == 200 || code == 201);
    Serial.printf("HTTP %d — %s\n", code, http.getString().c_str());
    http.end();
  }

  lastPostSuccess = ok;
  lastPostTime    = getShortTime();
  postCount++;

  drawStats();
}

// ───────────────────────────────────────────
// Setup
// ───────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\nCYD Dummy Sensor Node starting…");

  // Backlight
  pinMode(TFT_BACKLIGHT_PIN, OUTPUT);
  setBacklight(true);

  // Display
  tft.init();
  tft.setRotation(1); // landscape
  tft.fillScreen(C_BG);

  // Touch (shares the same SPI bus; XPT2046_Touchscreen handles CS itself)
  ts.begin();
  ts.setRotation(1);

  // Splash
  tft.setTextColor(C_WHITE, C_BG);
  tft.drawCentreString("Connecting to WiFi…", SCREEN_W / 2, SCREEN_H / 2 - 10, 2);

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected: " + WiFi.localIP().toString());
  } else {
    Serial.println("WiFi connection failed — continuing offline");
  }

  // NTP
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Waiting for NTP sync");
  time_t now = time(nullptr);
  unsigned long ntpStart = millis();
  while (now < 1577836800 && millis() - ntpStart < 10000) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println();

  lastTouchMs = millis();
  drawFullScreen();

  // Post immediately on boot
  postData();
  lastPostMs = millis();
}

// ───────────────────────────────────────────
// Loop
// ───────────────────────────────────────────

void loop() {
  unsigned long now = millis();

  // ── Touch handling ──────────────────────
  int px, py;
  if (getTouchPixel(px, py)) {

    if (!displayAwake) {
      // Any touch just wakes the screen
      wakeDisplay();
      delay(200); // debounce — ignore the wake tap
    } else {
      lastTouchMs = now;

      if (insideButton(px, py)) {
        sendNormal = !sendNormal;
        Serial.printf("Mode toggled → %s\n", sendNormal ? "HEALTHY" : "UNHEALTHY");
        drawToggleButton();
        drawStats();
        delay(150); // simple debounce
      }
    }
  }

  // ── Sleep timeout ───────────────────────
  if (displayAwake && (now - lastTouchMs >= SLEEP_TIMEOUT_MS)) {
    Serial.println("Display sleeping (touch to wake)");
    setBacklight(false);
  }

  // ── Refresh WiFi indicator periodically ─
  if (displayAwake && (now % 5000 < 50)) {
    drawStatusBar();
  }

  // ── Post data on interval ───────────────
  if (now - lastPostMs >= POST_INTERVAL_MS) {
    lastPostMs = now;
    postData();
  }
}
