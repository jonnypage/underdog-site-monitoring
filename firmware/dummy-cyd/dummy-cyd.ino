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
 *   TFT:   ILI9341  — VSPI bus  (MOSI=13, MISO=12, CLK=14, CS=15, DC=2)
 *   Touch: XPT2046  — HSPI bus  (MOSI=32, MISO=39, CLK=25, CS=33, IRQ=36)
 *   Backlight: GPIO 21, active-LOW (LOW = on, HIGH = off on most CYD boards)
 *
 * ── Required libraries (Arduino Library Manager) ──────────────────────────
 *   TFT_eSPI          by Bodmer         (configure User_Setup.h — see below)
 *   XPT2046_Touchscreen  by Paul Stoffregen
 *
 * ── TFT_eSPI User_Setup.h ─────────────────────────────────────────────────
 * Open <Arduino libraries folder>/TFT_eSPI/User_Setup.h, comment out any
 * existing driver #define, and add/replace with:
 *
 *   #define ILI9341_DRIVER
 *   #define TFT_WIDTH  240
 *   #define TFT_HEIGHT 320
 *   // VSPI pins for TFT
 *   #define TFT_MISO 12
 *   #define TFT_MOSI 13
 *   #define TFT_SCLK 14
 *   #define TFT_CS   15
 *   #define TFT_DC    2
 *   #define TFT_RST  -1
 *   // Do NOT define TFT_BL here — we drive it manually (active-LOW)
 *   #define LOAD_GLCD
 *   #define LOAD_FONT2
 *   #define LOAD_FONT4
 *   #define SPI_FREQUENCY       55000000
 *   #define SPI_READ_FREQUENCY  20000000
 *
 * ── Common causes of black screen ─────────────────────────────────────────
 *   1. User_Setup.h not edited — TFT_eSPI ships pointing at a different board.
 *   2. Backlight polarity — most CYDs need LOW to turn on the backlight.
 *   3. Touch on wrong SPI bus — XPT2046 must use HSPI, not the default VSPI.
 *   Open Serial Monitor at 115200 baud immediately after flashing; setup()
 *   prints a breadcrumb for every stage so you can see where it hangs.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <SPI.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>

// ============================================================
// CONFIGURATION — edit these values
// ============================================================
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";
const char *apiBaseUrl = "";
const char *deviceId = "device-123";
const char *apiKey = "YOUR_PLAINTEXT_API_KEY";

// How often to post (ms). Keep >= 5000.
const unsigned long POST_INTERVAL_MS = 15000;

// Backlight off after this many ms of no touch
const unsigned long SLEEP_TIMEOUT_MS = 30000;
// ============================================================

// ── Backlight ─────────────────────────────────────────────────────────────
// The CYD backlight (GPIO 21) can be active-HIGH or active-LOW depending on
// the board revision. We drive it with LEDC PWM so we can do full brightness
// without worrying about polarity — 255 = full on, 0 = full off.
// If the screen stays black, open Serial Monitor: you will see "BL blink" and
// the backlight will pulse 3 times. If it never lights up, your board may
// need a different GPIO or the User_Setup.h still has TFT_BL defined (remove it).
#define BL_PIN 21
#define BL_CHANNEL 0 // LEDC channel
#define BL_FREQ 5000 // Hz
#define BL_BITS 8    // 8-bit resolution (0-255)

// ── Touch — HSPI bus (separate from TFT's VSPI) ───────────────────────────
#define TOUCH_SCLK 25
#define TOUCH_MISO 39 // input-only GPIO on ESP32; fine for MISO
#define TOUCH_MOSI 32
#define TOUCH_CS 33
#define TOUCH_IRQ 36 // input-only GPIO

SPIClass touchSPI(HSPI);
XPT2046_Touchscreen ts(TOUCH_CS, TOUCH_IRQ);

// ── TFT (VSPI, pins set in User_Setup.h) ──────────────────────────────────
TFT_eSPI tft = TFT_eSPI();

// ── Layout ────────────────────────────────────────────────────────────────
const int SCREEN_W = 320;
const int SCREEN_H = 240;

// Large toggle button — centred in the middle third
const int BTN_W = 220;
const int BTN_H = 66;
const int BTN_X = (SCREEN_W - BTN_W) / 2; // 50
const int BTN_Y = 80;

// ── Touch calibration (raw ADC → screen pixels, landscape) ────────────────
// Adjust if taps feel misaligned on your specific unit.
const int T_X_MIN = 200, T_X_MAX = 3800;
const int T_Y_MIN = 200, T_Y_MAX = 3800;

// ── Colors ────────────────────────────────────────────────────────────────
#define C_BG TFT_BLACK
#define C_PANEL 0x1082  // very dark grey
#define C_ACCENT 0x055F // dark teal for header
#define C_GREEN 0x2724  // muted green
#define C_RED 0xA000    // muted red
#define C_WHITE TFT_WHITE
#define C_LTGREY 0x8C51
#define C_DKGREY 0x4208

// ── Runtime state ─────────────────────────────────────────────────────────
bool sendNormal = true;
bool displayAwake = true;
unsigned long lastTouchMs = 0;
unsigned long lastPostMs = 0;
bool lastPostOk = false;
String lastPostTime = "--:--:--";
int postCount = 0;

// =============================================================
// Drawing
// =============================================================

void drawStatusBar()
{
  tft.fillRect(0, 0, SCREEN_W, 32, C_ACCENT);
  tft.setTextColor(C_WHITE, C_ACCENT);
  tft.drawString("Underdog Dummy Node", 10, 9, 2);

  // WiFi dot — right side
  bool wifi = (WiFi.status() == WL_CONNECTED);
  uint16_t dot = wifi ? 0x07E0 : 0xF800; // bright green / red
  tft.fillCircle(SCREEN_W - 16, 16, 7, dot);
}

void drawToggleButton()
{
  uint16_t col = sendNormal ? C_GREEN : C_RED;
  uint16_t bord = sendNormal ? 0x07E0 : 0xF800;

  tft.fillRoundRect(BTN_X, BTN_Y, BTN_W, BTN_H, 12, col);
  tft.drawRoundRect(BTN_X, BTN_Y, BTN_W, BTN_H, 12, bord);
  tft.drawRoundRect(BTN_X + 1, BTN_Y + 1, BTN_W - 2, BTN_H - 2, 11, bord); // double border

  tft.setTextColor(C_WHITE, col);
  int cx = BTN_X + BTN_W / 2;
  if (sendNormal)
  {
    tft.drawCentreString("HEALTHY DATA", cx, BTN_Y + 12, 2);
    tft.drawCentreString("tap to send BAD", cx, BTN_Y + 38, 1);
  }
  else
  {
    tft.drawCentreString("UNHEALTHY DATA", cx, BTN_Y + 12, 2);
    tft.drawCentreString("tap to send GOOD", cx, BTN_Y + 38, 1);
  }
}

void drawStats()
{
  int y0 = BTN_Y + BTN_H + 14;
  tft.fillRect(0, y0, SCREEN_W, SCREEN_H - y0, C_BG);

  // Divider
  tft.drawFastHLine(10, y0, SCREEN_W - 20, C_DKGREY);
  y0 += 8;

  // Last post row
  tft.setTextColor(C_LTGREY, C_BG);
  tft.drawString("Last post:", 10, y0, 2);
  tft.setTextColor(lastPostOk ? 0x07E0 : 0xF800, C_BG);
  tft.drawString(lastPostOk ? "OK " : "ERR", 120, y0, 2);
  tft.setTextColor(C_WHITE, C_BG);
  tft.drawString(lastPostTime, 165, y0, 2);

  // Count row
  tft.setTextColor(C_LTGREY, C_BG);
  tft.drawString("Posts sent:", 10, y0 + 24, 2);
  tft.setTextColor(C_WHITE, C_BG);
  tft.drawString(String(postCount), 120, y0 + 24, 2);

  // IP row
  tft.setTextColor(C_LTGREY, C_BG);
  tft.drawString("IP:", 10, y0 + 48, 2);
  tft.setTextColor(C_WHITE, C_BG);
  String ip = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : "not connected";
  tft.drawString(ip, 42, y0 + 48, 2);
}

void drawFullScreen()
{
  tft.fillScreen(C_BG);
  drawStatusBar();
  drawToggleButton();
  drawStats();
}

// =============================================================
// Backlight / sleep
// =============================================================

void setBacklight(bool on)
{
  ledcWrite(BL_CHANNEL, on ? 255 : 0);
  displayAwake = on;
}

void wakeDisplay()
{
  setBacklight(true);
  drawFullScreen();
  lastTouchMs = millis();
}

// =============================================================
// Touch helpers
// =============================================================

bool readTouch(int &px, int &py)
{
  if (!ts.touched())
    return false;
  TS_Point p = ts.getPoint();

  // Landscape: raw X → screen Y, raw Y → screen X (for rotation 1)
  px = map(p.y, T_Y_MIN, T_Y_MAX, 0, SCREEN_W);
  py = map(p.x, T_X_MIN, T_X_MAX, 0, SCREEN_H);
  px = constrain(px, 0, SCREEN_W - 1);
  py = constrain(py, 0, SCREEN_H - 1);
  return true;
}

bool insideButton(int px, int py)
{
  return px >= BTN_X && px <= BTN_X + BTN_W &&
         py >= BTN_Y && py <= BTN_Y + BTN_H;
}

// =============================================================
// Time helpers
// =============================================================

String iso8601Now()
{
  time_t t = time(nullptr);
  struct tm ti;
  gmtime_r(&t, &ti);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &ti);
  return String(buf);
}

String shortTimeNow()
{
  time_t t = time(nullptr);
  struct tm ti;
  localtime_r(&t, &ti);
  char buf[10];
  strftime(buf, sizeof(buf), "%H:%M:%S", &ti);
  return String(buf);
}

// =============================================================
// API posting
// =============================================================

void postData()
{
  Serial.println("[POST] Building payload…");

  float temp, ph, wl, dox;
  if (sendNormal)
  {
    temp = 20.0f + random(0, 100) / 10.0f;
    ph = 6.5f + random(0, 20) / 10.0f;
    wl = 70.0f + random(0, 30);
    dox = 5.0f + random(0, 30) / 10.0f;
  }
  else
  {
    temp = 35.0f + random(0, 50) / 10.0f;
    ph = 4.0f + random(0, 10) / 10.0f;
    wl = 40.0f + random(0, 10);
    dox = 2.0f + random(0, 10) / 10.0f;
  }

  String ts_str = iso8601Now();
  String body = "{";
  body += "\"deviceId\":\"" + String(deviceId) + "\",";
  body += "\"timestamp\":\"" + ts_str + "\",";
  body += "\"readings\":{";
  body += "\"temperature\":" + String(temp, 2) + ",";
  body += "\"ph\":" + String(ph, 2) + ",";
  body += "\"waterLevel\":" + String(wl, 2) + ",";
  body += "\"dissolvedOxygen\":" + String(dox, 2);
  body += "}}";

  Serial.println("[POST] " + body);

  bool ok = false;

  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("[POST] Skipped — no WiFi");
  }
  else
  {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    if (http.begin(client, apiBaseUrl))
    {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-api-key", apiKey);
      int code = http.POST(body);
      ok = (code >= 200 && code < 300);
      Serial.printf("[POST] HTTP %d  %s\n", code, http.getString().c_str());
      http.end();
    }
    else
    {
      Serial.println("[POST] http.begin() failed");
    }
  }

  lastPostOk = ok;
  lastPostTime = shortTimeNow();
  postCount++;
  drawStats();
}

// =============================================================
// Setup
// =============================================================

void setup()
{
  Serial.begin(115200);
  delay(200);
  Serial.println("\n\n=== CYD Dummy Node booting ===");

  // ── Backlight — LEDC PWM (avoids polarity guessing) ───────────────────────
  Serial.println("[INIT] Backlight (LEDC PWM)…");
  ledcSetup(BL_CHANNEL, BL_FREQ, BL_BITS);
  ledcAttachPin(BL_PIN, BL_CHANNEL);
  // Blink 3 times so you can confirm the backlight circuit is responding
  for (int i = 0; i < 3; i++)
  {
    Serial.printf("[INIT] BL blink %d ON\n", i + 1);
    ledcWrite(BL_CHANNEL, 255);
    delay(300);
    Serial.printf("[INIT] BL blink %d OFF\n", i + 1);
    ledcWrite(BL_CHANNEL, 0);
    delay(200);
  }
  ledcWrite(BL_CHANNEL, 255); // leave on
  displayAwake = true;
  Serial.println("[INIT] Backlight ON (PWM 255/255)");

  // ── TFT init (VSPI, configured in User_Setup.h) ─────────────────────────
  Serial.println("[INIT] TFT…");
  tft.init();
  tft.setRotation(1); // landscape, USB port on right
  tft.fillScreen(TFT_BLACK);
  Serial.println("[INIT] TFT OK");

  // Splash so you know the screen works before any network activity
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawCentreString("Underdog Dummy Node", SCREEN_W / 2, 90, 4);
  tft.setTextColor(0x7BEF, TFT_BLACK);
  tft.drawCentreString("Starting up...", SCREEN_W / 2, 140, 2);

  // ── Touch init (HSPI — separate bus!) ───────────────────────────────────
  Serial.println("[INIT] Touch SPI (HSPI)…");
  touchSPI.begin(TOUCH_SCLK, TOUCH_MISO, TOUCH_MOSI, TOUCH_CS);
  ts.begin(touchSPI);
  ts.setRotation(1);
  Serial.println("[INIT] Touch OK");

  // ── WiFi ─────────────────────────────────────────────────────────────────
  Serial.println("[INIT] WiFi…");
  tft.setTextColor(0x7BEF, TFT_BLACK);
  tft.drawCentreString("Connecting to WiFi…", SCREEN_W / 2, 160, 2);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000)
  {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("[INIT] WiFi connected: " + WiFi.localIP().toString());
  }
  else
  {
    Serial.println("[INIT] WiFi timeout — running offline");
  }

  // ── NTP ──────────────────────────────────────────────────────────────────
  Serial.println("[INIT] NTP sync…");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = time(nullptr);
  t0 = millis();
  while (now < 1577836800 && millis() - t0 < 10000)
  {
    delay(400);
    now = time(nullptr);
  }
  Serial.printf("[INIT] NTP done  epoch=%ld\n", (long)now);

  // ── First draw ───────────────────────────────────────────────────────────
  lastTouchMs = millis();
  drawFullScreen();
  Serial.println("[INIT] First draw done");

  // Post on boot
  postData();
  lastPostMs = millis();

  Serial.println("=== Setup complete ===");
}

// =============================================================
// Loop
// =============================================================

void loop()
{
  unsigned long now = millis();

  // ── Touch ────────────────────────────────────────────────────────────────
  int px, py;
  if (readTouch(px, py))
  {
    if (!displayAwake)
    {
      wakeDisplay();
      delay(250); // absorb the wake tap
    }
    else
    {
      lastTouchMs = now;
      if (insideButton(px, py))
      {
        sendNormal = !sendNormal;
        Serial.printf("[TOUCH] Mode → %s\n", sendNormal ? "HEALTHY" : "UNHEALTHY");
        drawToggleButton();
        drawStats();
        delay(200); // debounce
      }
    }
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────
  if (displayAwake && now - lastTouchMs >= SLEEP_TIMEOUT_MS)
  {
    Serial.println("[SLEEP] Backlight off");
    setBacklight(false);
  }

  // ── Periodic WiFi dot refresh ─────────────────────────────────────────────
  static unsigned long lastDotRefresh = 0;
  if (displayAwake && now - lastDotRefresh >= 5000)
  {
    lastDotRefresh = now;
    drawStatusBar();
  }

  // ── Post data ─────────────────────────────────────────────────────────────
  if (now - lastPostMs >= POST_INTERVAL_MS)
  {
    lastPostMs = now;
    postData();
  }
}
