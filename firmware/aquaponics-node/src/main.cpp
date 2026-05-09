// Underdog aquaponics node firmware (Wemos D1 Mini / ESP8266).
//
// Lifecycle:
//   1. setup(): parse the embedded config blob, connect to Wi-Fi, start NTP.
//   2. loop():  every cfg.intervalSeconds, read every configured sensor,
//               build an /ingest payload, POST to the API, repeat.
//
// The config blob is patched into the firmware image by the web installer
// (see apps/web/lib/firmware/patch-config.ts). The serial console prints rich
// diagnostics so a tech can troubleshoot without reflashing.

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <time.h>
#include "ud_config.h"
#include "ud_sensors.h"
#include "ud_transport.h"

namespace {

ud::RuntimeConfig gConfig;
WiFiUDP gUdp;
NTPClient gNtp(gUdp, "pool.ntp.org", 0, 60UL * 60UL * 1000UL);

bool gNtpReady = false;
unsigned long gLastPostMs = 0;
unsigned long gNextPostDelayMs = 0;
unsigned long gBackoffMs = 0;

constexpr unsigned long kMaxBackoffMs = 5UL * 60UL * 1000UL;  // 5 min cap.

void connectWifi() {
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.hostname(gConfig.apiDeviceId);
    WiFi.begin(gConfig.wifiSsid, gConfig.wifiPass);

    Serial.print(F("[wifi] connecting to "));
    Serial.println(gConfig.wifiSsid);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < 30000UL) {
        delay(250);
        Serial.print('.');
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.print(F("[wifi] online ip="));
        Serial.println(WiFi.localIP());
    } else {
        Serial.println(F("[wifi] connect failed; will retry"));
    }
}

void ensureWifi() {
    if (WiFi.status() == WL_CONNECTED) return;
    connectWifi();
}

bool buildIso8601Utc(char* out, size_t outSize) {
    if (!gNtpReady) return false;
    time_t epoch = static_cast<time_t>(gNtp.getEpochTime());
    struct tm* utc = gmtime(&epoch);
    if (utc == nullptr) return false;
    size_t n = strftime(out, outSize, "%Y-%m-%dT%H:%M:%SZ", utc);
    return n > 0;
}

void readAllAndPost() {
    char timestamp[32];
    if (!buildIso8601Utc(timestamp, sizeof(timestamp))) {
        Serial.println(F("[loop] no NTP yet, skipping post"));
        return;
    }

    ud::ReadingSample samples[ud::kMaxSensors];
    size_t sampleCount = 0;

    for (uint8_t i = 0; i < gConfig.sensorCount; ++i) {
        const ud::SensorConfig& s = gConfig.sensors[i];
        const ud::SensorDriver* drv = ud::findDriver(s.driver);
        if (drv == nullptr) continue;
        ud::SensorReading r = drv->read(s);
        if (!r.ok) continue;
        samples[sampleCount].key = s.key;
        samples[sampleCount].value = r.value;
        sampleCount++;
    }

    if (sampleCount == 0) {
        Serial.println(F("[loop] no successful readings this cycle"));
        return;
    }

    int status = ud::postReadings(gConfig, timestamp, samples, sampleCount);
    if (status == 200) {
        gBackoffMs = 0;
    } else if (status == 400 || status == 401) {
        gBackoffMs = (gBackoffMs == 0) ? 30000UL : gBackoffMs * 2UL;
        if (gBackoffMs > kMaxBackoffMs) gBackoffMs = kMaxBackoffMs;
        Serial.print(F("[loop] non-retryable status "));
        Serial.print(status);
        Serial.print(F("; backing off "));
        Serial.print(gBackoffMs / 1000UL);
        Serial.println(F("s"));
    } else {
        gBackoffMs = (gBackoffMs == 0) ? 5000UL : gBackoffMs * 2UL;
        if (gBackoffMs > kMaxBackoffMs) gBackoffMs = kMaxBackoffMs;
    }
}

}  // namespace

void setup() {
    Serial.begin(115200);
    delay(50);
    Serial.println();
    Serial.print(F("[boot] underdog node fw "));
    Serial.print(F(UD_FW_VERSION));
    Serial.print(F(" board="));
    Serial.println(F(UD_BOARD));

    if (!ud::loadEmbeddedConfig(gConfig)) {
        Serial.println(F("[boot] config invalid; halting (reflash via installer)"));
        // Spin so the watchdog doesn't keep rebooting us; serial stays online
        // for debugging.
        while (true) {
            delay(5000);
            Serial.println(F("[boot] waiting for valid config (reflash needed)"));
        }
    }

    Serial.print(F("[boot] deviceId="));
    Serial.println(gConfig.apiDeviceId);
    Serial.print(F("[boot] api="));
    Serial.println(gConfig.apiBaseUrl);
    Serial.print(F("[boot] interval="));
    Serial.print(gConfig.intervalSeconds);
    Serial.println(F("s"));

    connectWifi();

    gNtp.begin();
    if (gNtp.forceUpdate()) {
        gNtpReady = true;
        Serial.print(F("[ntp] synced epoch="));
        Serial.println(gNtp.getEpochTime());
    } else {
        Serial.println(F("[ntp] initial sync failed; will retry"));
    }

    ud::setupAllSensors(gConfig);

    gNextPostDelayMs = 2000UL;  // first post shortly after boot.
    gLastPostMs = millis();
}

void loop() {
    ensureWifi();

    if (!gNtpReady) {
        if (gNtp.update()) {
            gNtpReady = true;
            Serial.print(F("[ntp] synced epoch="));
            Serial.println(gNtp.getEpochTime());
        }
    } else {
        gNtp.update();
    }

    unsigned long now = millis();
    unsigned long interval = (gBackoffMs > 0) ? gBackoffMs : (gConfig.intervalSeconds * 1000UL);
    if (gNextPostDelayMs > 0) {
        interval = gNextPostDelayMs;
    }

    if (now - gLastPostMs >= interval) {
        gLastPostMs = now;
        gNextPostDelayMs = 0;
        if (WiFi.status() == WL_CONNECTED) {
            readAllAndPost();
        } else {
            Serial.println(F("[loop] wifi down, skipping post"));
        }
    }

    delay(50);
}
