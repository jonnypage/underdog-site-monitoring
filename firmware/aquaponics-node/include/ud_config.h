#pragma once

#include <Arduino.h>
#include <stdint.h>

#ifndef UD_FW_VERSION
#define UD_FW_VERSION "dev"
#endif

#ifndef UD_BOARD
#define UD_BOARD "unknown"
#endif

namespace ud {

// Maximum runtime arrays / strings. These bounds let us avoid heap fragmentation
// on the ESP8266 by keeping the parsed config in a single struct.
static constexpr size_t kMaxSensors = 8;
static constexpr size_t kMaxStringLen = 96;
static constexpr size_t kMaxKeyLen = 32;
static constexpr size_t kMaxDriverLen = 24;

// Total size of the reserved config region embedded in the binary. The
// installer page splices a JSON document into this buffer between the begin
// and end markers (see config_block.cpp). 2 KiB is plenty of headroom for the
// MVP sensor catalog with a few entries while still being trivial to embed.
static constexpr size_t kConfigBlockSize = 2048;

static constexpr const char* kCfgBeginMarker = "__UD_CFG_BEGIN__";
static constexpr const char* kCfgEndMarker = "__UD_CFG_END__";

struct PinAssignment {
    char name[kMaxKeyLen];
    int32_t gpio;
};

struct SensorConfig {
    char key[kMaxKeyLen];
    char driver[kMaxDriverLen];
    PinAssignment pins[4];
    uint8_t pinCount;
    bool hasSlope;
    float slope;
    bool hasIntercept;
    float intercept;
};

struct RuntimeConfig {
    bool valid;
    uint16_t version;

    char wifiSsid[kMaxStringLen];
    char wifiPass[kMaxStringLen];

    char apiBaseUrl[kMaxStringLen];
    char apiDeviceId[kMaxStringLen];
    char apiKey[kMaxStringLen];

    uint32_t intervalSeconds;

    SensorConfig sensors[kMaxSensors];
    uint8_t sensorCount;
};

/**
 * Read the embedded JSON config blob from program flash, parse it with
 * ArduinoJson, and copy the typed values into `out`. Returns true on success.
 *
 * The blob must live between `__UD_CFG_BEGIN__` and `__UD_CFG_END__`; whitespace
 * around the JSON is allowed (the installer pads with spaces).
 */
bool loadEmbeddedConfig(RuntimeConfig& out);

/**
 * Helper for sensors: look up a pin by its name (e.g. "data", "trig", "echo",
 * "adc"). Returns -1 if not present so callers can apply driver defaults.
 */
int32_t findPin(const SensorConfig& sensor, const char* name);

/** Pointer into the embedded JSON region (NOT null-terminated; padded with spaces). */
const char* embeddedConfigJson();
size_t embeddedConfigJsonCapacity();

}  // namespace ud
