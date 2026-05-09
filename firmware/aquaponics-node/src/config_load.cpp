// Parses the JSON document inside the embedded config block into the typed
// RuntimeConfig used by the rest of the firmware.

#include <ArduinoJson.h>
#include <Arduino.h>
#include <string.h>
#include "ud_config.h"

namespace ud {

namespace {

void copyString(char* dst, size_t dstSize, const char* src) {
    if (dstSize == 0) return;
    if (src == nullptr) {
        dst[0] = '\0';
        return;
    }
    strncpy(dst, src, dstSize - 1);
    dst[dstSize - 1] = '\0';
}

}  // namespace

int32_t findPin(const SensorConfig& sensor, const char* name) {
    for (uint8_t i = 0; i < sensor.pinCount; ++i) {
        if (strncmp(sensor.pins[i].name, name, kMaxKeyLen) == 0) {
            return sensor.pins[i].gpio;
        }
    }
    return -1;
}

bool loadEmbeddedConfig(RuntimeConfig& out) {
    memset(&out, 0, sizeof(out));

    // Copy the (whitespace-padded) JSON region into a heap buffer that we can
    // safely null-terminate before handing it to ArduinoJson. This avoids
    // making assumptions about flash alignment.
    const size_t cap = embeddedConfigJsonCapacity();
    char* buf = static_cast<char*>(malloc(cap + 1));
    if (buf == nullptr) {
        return false;
    }
    memcpy(buf, embeddedConfigJson(), cap);
    buf[cap] = '\0';

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, buf);
    free(buf);
    if (err) {
        Serial.print(F("[config] JSON parse failed: "));
        Serial.println(err.c_str());
        return false;
    }

    out.version = doc["v"] | 0;
    if (out.version != 1) {
        Serial.println(F("[config] unsupported config version"));
        return false;
    }

    copyString(out.wifiSsid, sizeof(out.wifiSsid), doc["wifi"]["ssid"] | "");
    copyString(out.wifiPass, sizeof(out.wifiPass), doc["wifi"]["pass"] | "");
    copyString(out.apiBaseUrl, sizeof(out.apiBaseUrl), doc["api"]["baseUrl"] | "");
    copyString(out.apiDeviceId, sizeof(out.apiDeviceId), doc["api"]["deviceId"] | "");
    copyString(out.apiKey, sizeof(out.apiKey), doc["api"]["apiKey"] | "");

    out.intervalSeconds = doc["intervalSeconds"] | 300U;
    if (out.intervalSeconds < 5) out.intervalSeconds = 5;

    JsonArrayConst sensors = doc["sensors"].as<JsonArrayConst>();
    out.sensorCount = 0;
    for (JsonObjectConst s : sensors) {
        if (out.sensorCount >= kMaxSensors) break;
        SensorConfig& dst = out.sensors[out.sensorCount];
        memset(&dst, 0, sizeof(dst));
        copyString(dst.key, sizeof(dst.key), s["key"] | "");
        copyString(dst.driver, sizeof(dst.driver), s["driver"] | "");

        JsonObjectConst pins = s["pins"].as<JsonObjectConst>();
        dst.pinCount = 0;
        for (JsonPairConst kv : pins) {
            if (dst.pinCount >= 4) break;
            copyString(dst.pins[dst.pinCount].name, kMaxKeyLen, kv.key().c_str());
            dst.pins[dst.pinCount].gpio = kv.value().as<int32_t>();
            dst.pinCount++;
        }

        JsonVariantConst cal = s["cal"];
        if (!cal.isNull()) {
            JsonVariantConst slope = cal["slope"];
            if (!slope.isNull()) {
                dst.hasSlope = true;
                dst.slope = slope.as<float>();
            }
            JsonVariantConst intercept = cal["intercept"];
            if (!intercept.isNull()) {
                dst.hasIntercept = true;
                dst.intercept = intercept.as<float>();
            }
        }

        if (dst.key[0] != '\0' && dst.driver[0] != '\0') {
            out.sensorCount++;
        }
    }

    out.valid =
        out.wifiSsid[0] != '\0' &&
        out.apiBaseUrl[0] != '\0' &&
        out.apiDeviceId[0] != '\0' &&
        out.apiKey[0] != '\0' &&
        out.sensorCount > 0;

    return out.valid;
}

}  // namespace ud
