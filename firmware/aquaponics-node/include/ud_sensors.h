#pragma once

#include <Arduino.h>
#include <stddef.h>
#include <stdint.h>
#include "ud_config.h"

namespace ud {

/**
 * Result of a single sensor read.
 *  - ok=true: `value` should be sent in the next /ingest payload.
 *  - ok=false: skip this sensor for this cycle (logged for the firmware to
 *    surface in serial output but not posted; partial uploads are allowed).
 */
struct SensorReading {
    bool ok;
    float value;
};

using SensorReadFn = SensorReading (*)(const SensorConfig& cfg);

/** Per-sensor lifecycle. setup() is called once after parsing config. */
using SensorSetupFn = void (*)(const SensorConfig& cfg);

struct SensorDriver {
    const char* driverKey;  // matches RuntimeConfig.sensors[].driver
    SensorSetupFn setup;
    SensorReadFn read;
};

/** Look up a driver by its config key, or nullptr if unknown to this build. */
const SensorDriver* findDriver(const char* driverKey);

/** Call setup() for every configured sensor whose driver is known. */
void setupAllSensors(const RuntimeConfig& cfg);

}  // namespace ud
