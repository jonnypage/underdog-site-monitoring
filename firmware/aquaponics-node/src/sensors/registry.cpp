#include <string.h>
#include "ud_sensors.h"

namespace ud {

extern const SensorDriver kDriverDs18b20;
extern const SensorDriver kDriverAnalogPh;
extern const SensorDriver kDriverHcsr04;
extern const SensorDriver kDriverAnalogDo;

namespace {

const SensorDriver* const kDrivers[] = {
    &kDriverDs18b20,
    &kDriverAnalogPh,
    &kDriverHcsr04,
    &kDriverAnalogDo,
};

constexpr size_t kDriverCount = sizeof(kDrivers) / sizeof(kDrivers[0]);

}  // namespace

const SensorDriver* findDriver(const char* driverKey) {
    if (driverKey == nullptr || driverKey[0] == '\0') return nullptr;
    for (size_t i = 0; i < kDriverCount; ++i) {
        if (strcmp(kDrivers[i]->driverKey, driverKey) == 0) {
            return kDrivers[i];
        }
    }
    return nullptr;
}

void setupAllSensors(const RuntimeConfig& cfg) {
    for (uint8_t i = 0; i < cfg.sensorCount; ++i) {
        const SensorConfig& s = cfg.sensors[i];
        const SensorDriver* drv = findDriver(s.driver);
        if (drv == nullptr) {
            Serial.print(F("[sensors] unknown driver: "));
            Serial.println(s.driver);
            continue;
        }
        if (drv->setup != nullptr) {
            drv->setup(s);
        }
    }
}

}  // namespace ud
