// DS18B20 OneWire temperature sensor driver.
//
// Default Wemos D1 Mini wiring: data on D2 (GPIO4), 4.7k pull-up to 3.3V.
// Multiple probes on the same bus are supported in hardware; this driver
// reports the first device that answers, which is sufficient for the MVP.

#include <DallasTemperature.h>
#include <OneWire.h>
#include "ud_sensors.h"

namespace ud {

namespace {

constexpr int kDefaultDataPin = 4;  // D2 on the Wemos D1 Mini.

OneWire* gOneWire = nullptr;
DallasTemperature* gSensors = nullptr;

void setup(const SensorConfig& cfg) {
    int32_t pin = findPin(cfg, "data");
    if (pin < 0) pin = kDefaultDataPin;

    delete gSensors;
    delete gOneWire;
    gOneWire = new OneWire(static_cast<uint8_t>(pin));
    gSensors = new DallasTemperature(gOneWire);
    gSensors->begin();
    gSensors->setResolution(12);
    Serial.print(F("[ds18b20] data pin GPIO"));
    Serial.println(pin);
}

SensorReading read(const SensorConfig& /*cfg*/) {
    SensorReading r{false, 0.0f};
    if (gSensors == nullptr) return r;

    gSensors->requestTemperatures();
    float c = gSensors->getTempCByIndex(0);
    if (c == DEVICE_DISCONNECTED_C || c < -55.0f || c > 125.0f) {
        Serial.println(F("[ds18b20] no probe / out of range"));
        return r;
    }
    r.ok = true;
    r.value = c;
    return r;
}

}  // namespace

const SensorDriver kDriverDs18b20 = {"ds18b20", &setup, &read};

}  // namespace ud
