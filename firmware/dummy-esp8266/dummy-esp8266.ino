#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <time.h>

// ==========================================
// CONFIGURATION
// ==========================================
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";

// Use HTTP for local testing or HTTPS if testing against production.
// If testing locally (e.g. your computer), use your computer's local IP address
// on the same network instead of localhost.
const char *apiBaseUrl = "";

// The ID of the device registered in the Underdog admin dashboard
const char *deviceId = "device-123";

// The plaintext API key shown ONCE when generating the device
const char *apiKey = "YOUR_PLAINTEXT_API_KEY";

// How often to post dummy data (in milliseconds)
const int postIntervalMs = 15000;

// If true, sends values within normal ranges. If false, sends values outside normal ranges to trigger alerts.
const bool sendNormalRanges = true;
// ==========================================

void setup()
{
  Serial.begin(115200);
  Serial.println();
  Serial.println("Starting Dummy Sensor Node...");

  // Connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Setup NTP to synchronize time for correct ISO 8601 timestamps
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Waiting for NTP time sync");
  time_t now = time(nullptr);

  // Wait until time is greater than Jan 1, 2020 (meaning NTP synced)
  while (now < 1577836800)
  {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println("\nTime synchronized.");
}

// Format the current time as an ISO 8601 UTC string (e.g. 2026-05-09T15:00:00Z)
String getIso8601Time()
{
  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

void loop()
{
  if (WiFi.status() == WL_CONNECTED)
  {
    WiFiClientSecure client;
    client.setInsecure(); // Skip certificate validation for simple testing
    HTTPClient http;

    Serial.print("\nConnecting to API: ");
    Serial.println(apiBaseUrl);

    if (http.begin(client, apiBaseUrl))
    {
      // 1. Set required headers
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-api-key", apiKey);

      // 2. Generate random dummy data
      float temp, ph, waterLevel, do_val;

      if (sendNormalRanges)
      {
        // Realistic normal ranges
        temp = 20.0 + (random(0, 100) / 10.0); // 20.0 to 30.0
        ph = 6.5 + (random(0, 20) / 10.0);     // 6.5 to 8.5
        waterLevel = 70.0 + (random(0, 30));   // 70.0 to 100.0
        do_val = 5.0 + (random(0, 30) / 10.0); // 5.0 to 8.0
      }
      else
      {
        // Values outside typical thresholds to trigger alerts
        temp = 35.0 + (random(0, 50) / 10.0);  // 35.0 to 40.0
        ph = 4.0 + (random(0, 10) / 10.0);     // 4.0 to 5.0
        waterLevel = 40.0 + (random(0, 10));   // 40.0 to 50.0
        do_val = 2.0 + (random(0, 10) / 10.0); // 2.0 to 3.0
      }

      String timestamp = getIso8601Time();

      // 3. Build JSON payload manually (avoiding heavy JSON libraries for simplicity)
      String payload = "{";
      payload += "\"deviceId\":\"" + String(deviceId) + "\",";
      payload += "\"timestamp\":\"" + timestamp + "\",";
      payload += "\"readings\":{";
      payload += "\"temperature\":" + String(temp, 1) + ",";
      payload += "\"ph\":" + String(ph, 1) + ",";
      payload += "\"waterLevel\":" + String(waterLevel, 1) + ",";
      payload += "\"dissolvedOxygen\":" + String(do_val, 1);
      payload += "}}";

      Serial.println("Sending JSON payload:");
      Serial.println(payload);

      // 4. Send the POST request
      int httpResponseCode = http.POST(payload);

      // 5. Handle response
      if (httpResponseCode > 0)
      {
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
        String response = http.getString();
        Serial.println("Server Response: " + response);
      }
      else
      {
        Serial.print("Error sending POST: ");
        Serial.println(http.errorToString(httpResponseCode));
      }
      http.end();
    }
    else
    {
      Serial.println("Unable to connect to the API host.");
    }
  }
  else
  {
    Serial.println("WiFi Disconnected. Waiting for reconnect...");
  }

  // Wait before sending the next reading
  delay(postIntervalMs);
}
