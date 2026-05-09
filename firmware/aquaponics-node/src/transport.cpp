#include <Arduino.h>
#include <ArduinoJson.h>
#include <string.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include "ud_transport.h"

namespace ud {

namespace {

bool urlIsHttps(const char* url) {
    return strncmp(url, "https://", 8) == 0;
}

}  // namespace

int postReadings(const RuntimeConfig& cfg,
                 const char* timestampIso,
                 const ReadingSample* samples,
                 size_t sampleCount) {
    if (sampleCount == 0) return 0;

    JsonDocument doc;
    doc["deviceId"] = cfg.apiDeviceId;
    doc["timestamp"] = timestampIso;
    JsonObject readings = doc["readings"].to<JsonObject>();
    for (size_t i = 0; i < sampleCount; ++i) {
        readings[samples[i].key] = samples[i].value;
    }

    String body;
    serializeJson(doc, body);

    String url = String(cfg.apiBaseUrl);
    if (url.endsWith("/")) url.remove(url.length() - 1);
    url += "/ingest";

    HTTPClient http;
    int status = 0;

    if (urlIsHttps(url.c_str())) {
        WiFiClientSecure client;
        // v1: skip certificate validation. Pinning is a follow-up; see
        // docs/esp-device-ingest.md §1 for production guidance.
        client.setInsecure();
        if (!http.begin(client, url)) {
            Serial.println(F("[transport] http.begin (https) failed"));
            return 0;
        }
    } else {
        WiFiClient client;
        if (!http.begin(client, url)) {
            Serial.println(F("[transport] http.begin (http) failed"));
            return 0;
        }
    }

    http.addHeader(F("Content-Type"), F("application/json"));
    http.addHeader(F("x-api-key"), cfg.apiKey);
    http.setTimeout(8000);

    Serial.print(F("[transport] POST "));
    Serial.println(url);
    status = http.POST(body);

    String resp = http.getString();
    Serial.print(F("[transport] status="));
    Serial.print(status);
    Serial.print(F(" body="));
    Serial.println(resp);

    http.end();
    return status;
}

}  // namespace ud
